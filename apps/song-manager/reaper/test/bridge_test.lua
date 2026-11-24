-- Plain-Lua tests for the bridge, run against mock_reaper.lua: lua apps/song-manager/reaper/test/bridge_test.lua
-- (npm test runs them too, when lua is installed).

local here = debug.getinfo(1, "S").source:match("^@(.*[/\\])") or "./"
package.path = here .. "?.lua;" .. here .. "../SongManager/?.lua;" .. package.path

local json = require("json")
local base64 = require("base64")
local tracks = require("tracks")
local Bridge = require("bridge")
local Mock = require("mock_reaper")

local failures, count = 0, 0

local function test(name, fn)
  count = count + 1
  local ok, err = pcall(fn)
  if not ok then
    failures = failures + 1
    print("FAIL " .. name .. ": " .. tostring(err))
  end
end

local function eq(actual, expected, what)
  if actual ~= expected then
    error(string.format("%s: expected %s, got %s", what or "value", tostring(expected), tostring(actual)), 2)
  end
end

local function setup()
  local m = Mock.new()
  local bridge = Bridge.new(m.r)
  bridge:start()
  return m, bridge
end

local function state(m) return json.decode(m.ext["SongManager/state"]) end
local function seq(m) return m.ext["SongManager/state_seq"] end

local function send(m, bridge, cmd)
  m.ext["SongManager/cmd"] = base64.encode(json.encode(cmd))
  bridge:tick()
  return json.decode(m.ext["SongManager/result"])
end

-- json and base64

test("json encodes objects with sorted keys and keeps empty arrays", function()
  eq(json.encode({ b = 1, a = { 1, 2 }, c = json.array(), d = "x\"\n" }), '{"a":[1,2],"b":1,"c":[],"d":"x\\"\\n"}')
end)

test("json round-trips nested values, unicode and floats", function()
  local v = json.decode('{"a":[1,2.5,-3e2,true,null],"s":"\\u00e9\\ud83c\\udfb9 ok"}')
  eq(v.a[2], 2.5)
  eq(v.a[3], -300.0)
  eq(v.a[5], json.null)
  eq(v.s, "é🎹 ok")
  eq(json.encode(1.0), "1")
end)

test("base64url round-trips JSON with slashes and semicolons", function()
  local text = '{"port":"a/b;c%d","name":"é"}'
  eq(base64.decode(base64.encode(text)), text)
  eq(base64.decode("eyJhIjoxfQ"), '{"a":1}')
end)

-- track fields

test("MIDI record input encodes the port index and channel, and decodes to the name", function()
  local m = Mock.new()
  local ports = tracks.scanPorts(m.r)
  local v = tracks.encodeInput({ kind = "midi", port = "H12MIDI-Pro Port 3", channel = 10 }, ports)
  eq(v, 4096 | (2 << 5) | 10)
  local back = tracks.decodeInput(v + 0.0, ports.inputNames)
  eq(back.port, "H12MIDI-Pro Port 3")
  eq(back.channel, 10)
  eq(tracks.decodeInput(4096 + (63 << 5) + 0.0, ports.inputNames).port, "all")
end)

test("audio input encodes the 1-based channel and stereo flag", function()
  local v = tracks.encodeInput({ kind = "audio", channel = 5, stereo = true }, {})
  eq(v, 4 | 1024)
  local back = tracks.decodeInput(v, {})
  eq(back.channel, 5)
  eq(back.stereo, true)
end)

test("an unknown port or an output above index 31 is refused", function()
  local m = Mock.new()
  local ports = tracks.scanPorts(m.r)
  local ok, err = pcall(tracks.encodeInput, { kind = "midi", port = "Nope", channel = 1 }, ports)
  eq(ok, false)
  eq(err, "MIDI port not found in Reaper: Nope")
  ok, err = pcall(tracks.encodeMidiOut, "Far Away Port", 1, ports)
  eq(ok, false)
  eq(err:find("0–31") ~= nil, true, "error mentions the limit")
end)

test("the FX chain is cut out of a track chunk", function()
  local chunk = "<TRACK\n  NAME x\n  <FXCHAIN\n    SHOW 0\n    <VST \"VST: Synth\"\n      AAAA\n    >\n  >\n>\n"
  eq(tracks.fxChain(chunk), "SHOW 0\n<VST \"VST: Synth\"\nAAAA\n>\n")
end)

-- the loop

test("state lists tracks by GUID with arm, mute and solo", function()
  local m, bridge = setup()
  m.addTrack("Bass")
  bridge:tick()
  local s = state(m)
  eq(#s.tracks, 1)
  eq(s.tracks[1].guid, m.tracks[1].guid)
  eq(s.tracks[1].name, "Bass")
  eq(s.tracks[1].arm, false)
  eq(s.ports.outputs[2], "H12MIDI-Pro Port 2")
end)

test("arm, mute and solo changes are published although the change count doesn't move", function()
  local m, bridge = setup()
  local t = m.addTrack("Bass")
  bridge:tick()
  local before, count = seq(m), m.changeCount
  t.values.I_RECARM, t.values.B_MUTE, t.values.I_SOLO = 1, 1, 2
  bridge:tick()
  eq(m.changeCount, count, "change count")
  eq(seq(m) ~= before, true, "state_seq moved")
  local s = state(m).tracks[1]
  eq(s.arm, true)
  eq(s.mute, true)
  eq(s.solo, 2)
end)

test("nothing is republished when nothing changed", function()
  local m, bridge = setup()
  m.addTrack("Bass")
  bridge:tick()
  local before = seq(m)
  bridge:tick()
  eq(seq(m), before)
end)

test("create-track returns the new GUID and stores the part id", function()
  local m, bridge = setup()
  local result = send(m, bridge, { id = 7, type = "create-track", name = "JV-2080 Pads", part = "jv2080-pads" })
  eq(result.ok, true)
  eq(result.id, 7)
  eq(result.data.track, m.tracks[1].guid)
  eq(state(m).tracks[1].part, "jv2080-pads")
  eq(m.calls[1], "undo-begin")
  eq(m.calls[2], "undo-end Song Manager: create-track")
end)

test("set-input, set-hw-midi-out, set-monitor and arm show up in the state", function()
  local m, bridge = setup()
  local guid = send(m, bridge, { id = 1, type = "create-track", name = "Pads" }).data.track
  send(m, bridge, { id = 2, type = "set-input", track = guid, input = { kind = "midi", port = "H12MIDI-Pro Port 3", channel = 6 } })
  send(m, bridge, { id = 3, type = "set-hw-midi-out", track = guid, port = "H12MIDI-Pro Port 2", channel = 6 })
  send(m, bridge, { id = 4, type = "set-monitor", track = guid, mode = 0 })
  local result = send(m, bridge, { id = 5, type = "arm", track = guid, on = true })
  eq(result.ok, true)
  local t = state(m).tracks[1]
  eq(t.input.port, "H12MIDI-Pro Port 3")
  eq(t.input.channel, 6)
  eq(t.midiOut.port, "H12MIDI-Pro Port 2")
  eq(t.monitor, 0)
  eq(t.arm, true)
end)

test("GUIDs match whatever their case", function()
  local m, bridge = setup()
  local t = m.addTrack("Bass")
  local result = send(m, bridge, { id = 1, type = "mute", track = t.guid:lower(), on = true })
  eq(result.ok, true)
  eq(t.values.B_MUTE, 1)
end)

test("a command for a track that's gone fails and names the GUID", function()
  local m, bridge = setup()
  local t = m.addTrack("Bass")
  bridge:tick()
  m.r.DeleteTrack(t)
  local result = send(m, bridge, { id = 9, type = "arm", track = t.guid, on = true })
  eq(result.ok, false)
  eq(result.error, "track not found: " .. t.guid)
  eq(#state(m).tracks, 0)
end)

test("the note filter is added, read back and removed", function()
  local m, bridge = setup()
  local t = m.addTrack("TR-8S BD")
  send(m, bridge, { id = 1, type = "set-note-filter", track = t.guid, notes = { 36, 38 } })
  local notes = state(m).tracks[1].noteFilter
  eq(#notes, 2)
  eq(notes[2], 38)
  send(m, bridge, { id = 2, type = "set-note-filter", track = t.guid, notes = json.null })
  eq(state(m).tracks[1].noteFilter, json.null)
end)

test("read-only commands skip the undo block", function()
  local m, bridge = setup()
  local result = send(m, bridge, { id = 1, type = "get-state" })
  eq(result.ok, true)
  eq(#m.calls, 0)
end)

test("notes-off sends CC 123 to the named output", function()
  local m, bridge = setup()
  send(m, bridge, { id = 1, type = "notes-off", port = "H12MIDI-Pro Port 2", channels = { 6 } })
  eq(m.sent[1][1], 17)
  eq(m.sent[1][2], 0xB5)
  eq(m.sent[1][3], 123)
end)

test("add-marker places a bar, save-fx-chain returns the chain", function()
  local m, bridge = setup()
  local t = m.addTrack("Synth")
  send(m, bridge, { id = 1, type = "add-marker", bar = 3, name = "Chorus" })
  eq(m.marker.pos, 4)
  eq(m.marker.name, "Chorus")
  local result = send(m, bridge, { id = 2, type = "save-fx-chain", track = t.guid })
  eq(result.data.fxChain:find("VST: Synth", 1, true) ~= nil, true)
end)

test("plain JSON commands work too, and bad ones answer with an error", function()
  local m, bridge = setup()
  m.ext["SongManager/cmd"] = '{"id":"a","type":"ping"}'
  bridge:tick()
  eq(json.decode(m.ext["SongManager/result"]).data.pong, true)
  m.ext["SongManager/cmd"] = "!!!"
  bridge:tick()
  eq(json.decode(m.ext["SongManager/result"]).ok, false)
  local result = send(m, bridge, { id = 3, type = "dance" })
  eq(result.error, "unknown command: dance")
end)

test("a second copy takes over and the first stops", function()
  local m, bridge = setup()
  m.now = 5
  local second = Bridge.new(m.r)
  second:start()
  eq(bridge:tick(), false)
  eq(second:tick(), true)
  bridge:stop()
  eq(m.ext["SongManager/instance"], second.instance, "first copy leaves the keys alone")
  second:stop()
  eq(m.ext["SongManager/state"], nil)
end)

test("alive counts up once a second", function()
  local m, bridge = setup()
  bridge:tick()
  eq(m.ext["SongManager/alive"], "1")
  m.now = 0.5
  bridge:tick()
  eq(m.ext["SongManager/alive"], "1")
  m.now = 1.2
  bridge:tick()
  eq(m.ext["SongManager/alive"], "2")
end)

print(string.format("%d tests, %d failed", count, failures))
os.exit(failures == 0 and 0 or 1)
