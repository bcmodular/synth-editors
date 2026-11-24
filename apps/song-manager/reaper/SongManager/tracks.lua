-- Reading tracks and MIDI ports, and encoding the track fields the bridge sets.
-- Reaper stores MIDI inputs and outputs as device indexes; the app only ever sees port names.

local json = require("json")

local tracks = {}

tracks.PART_KEY = "P_EXT:SongManager"
tracks.NOTE_FILTER_NAMES = { "JS:SongManager/note_filter.jsfx", "JS:Song Manager note filter" }
tracks.NOTE_FILTER_SLOTS = 8
tracks.REC_FX = 0x1000000

local MIDI_INPUT_FLAG = 4096
local ALL_INPUTS, VIRTUAL_KEYBOARD = 63, 62

local function int(v)
  return math.tointeger(math.floor(v + 0.5))
end
tracks.int = int

-- Ports

local function scanPorts(count, nameOf)
  local list, byIndex = json.array(), {}
  for i = 0, count - 1 do
    local present, name = nameOf(i, "")
    if present then
      list[#list + 1] = { index = i, name = name }
      byIndex[i] = name
    end
  end
  return list, byIndex
end

function tracks.scanPorts(r)
  local inputs, inputNames = scanPorts(r.GetNumMIDIInputs(), r.GetMIDIInputName)
  local outputs, outputNames = scanPorts(r.GetNumMIDIOutputs(), r.GetMIDIOutputName)
  return { inputs = inputs, outputs = outputs, inputNames = inputNames, outputNames = outputNames }
end

local function findPort(list, name)
  for _, port in ipairs(list) do
    if port.name == name then return port.index end
  end
  error("MIDI port not found in Reaper: " .. tostring(name), 0)
end
tracks.findPort = findPort

-- Record input (I_RECINPUT)

local function decodeMidiInput(v, names)
  local device = (v >> 5) & 63
  local port = names[device] or ("device " .. device)
  if device == ALL_INPUTS then port = "all" elseif device == VIRTUAL_KEYBOARD then port = "virtual keyboard" end
  return { kind = "midi", port = port, channel = v & 31 }
end

function tracks.decodeInput(value, names)
  local v = int(value)
  if v < 0 then return { kind = "none" } end
  if v & MIDI_INPUT_FLAG ~= 0 then return decodeMidiInput(v, names) end
  return { kind = "audio", channel = (v & 1023) + 1, stereo = v & 1024 ~= 0 }
end

local function checkChannel(channel)
  local ch = channel or 0
  if math.type(ch) ~= "integer" or ch < 0 or ch > 16 then error("channel must be 0 (all) or 1–16", 0) end
  return ch
end

function tracks.encodeInput(input, ports)
  if input == nil or input == json.null or input.kind == "none" then return -1 end
  if input.kind == "audio" then
    local ch = input.channel
    if math.type(ch) ~= "integer" or ch < 1 or ch > 1024 then error("audio channel must be 1–1024", 0) end
    return (ch - 1) | (input.stereo and 1024 or 0)
  end
  if input.kind ~= "midi" then error("input kind must be midi, audio or none", 0) end
  local device = input.port == "all" and ALL_INPUTS or findPort(ports.inputs, input.port)
  if device > 61 and device ~= ALL_INPUTS then error("MIDI input index " .. device .. " is above 61", 0) end
  return MIDI_INPUT_FLAG | (device << 5) | checkChannel(input.channel)
end

-- MIDI hardware output (I_MIDIHWOUT)

function tracks.decodeMidiOut(value, names)
  local v = int(value)
  if v < 0 then return json.null end
  local device = (v >> 5) & 31
  return { port = names[device] or ("device " .. device), channel = v & 31 }
end

function tracks.encodeMidiOut(port, channel, ports)
  if port == nil or port == json.null then return -1 end
  local device = findPort(ports.outputs, port)
  if device > 31 then error("MIDI output " .. port .. " has index " .. device .. "; tracks only reach 0–31", 0) end
  return (device << 5) | checkChannel(channel)
end

-- Note filter (record-input JSFX)

function tracks.findNoteFilter(r, tr, instantiate)
  for _, name in ipairs(tracks.NOTE_FILTER_NAMES) do
    local pos = r.TrackFX_AddByName(tr, name, true, instantiate)
    if pos >= 0 then return tracks.REC_FX + pos end
  end
  return nil
end

function tracks.readNoteFilter(r, tr)
  local fx = tracks.findNoteFilter(r, tr, 0)
  if not fx then return json.null end
  local notes = json.array()
  for slot = 0, tracks.NOTE_FILTER_SLOTS - 1 do
    local note = int(r.TrackFX_GetParam(tr, fx, slot))
    if note >= 0 then notes[#notes + 1] = note end
  end
  return notes
end

-- One track's state, without the per-tick flags

local function info(r, tr, key)
  local _, value = r.GetSetMediaTrackInfo_String(tr, key, "", false)
  return value
end

function tracks.read(r, tr, ports)
  local part = info(r, tr, tracks.PART_KEY)
  return {
    guid = r.GetTrackGUID(tr),
    name = info(r, tr, "P_NAME"),
    part = part ~= "" and part or json.null,
    input = tracks.decodeInput(r.GetMediaTrackInfo_Value(tr, "I_RECINPUT"), ports.inputNames),
    recordMode = int(r.GetMediaTrackInfo_Value(tr, "I_RECMODE")),
    monitor = int(r.GetMediaTrackInfo_Value(tr, "I_RECMON")),
    midiOut = tracks.decodeMidiOut(r.GetMediaTrackInfo_Value(tr, "I_MIDIHWOUT"), ports.outputNames),
    noteFilter = tracks.readNoteFilter(r, tr),
  }
end

-- Arm, mute and solo, read every tick. Solo keeps Reaper's number (0, 1, 2, 5 or 6).
function tracks.flags(r, tr)
  return int(r.GetMediaTrackInfo_Value(tr, "I_RECARM")) ~= 0,
      r.GetMediaTrackInfo_Value(tr, "B_MUTE") ~= 0,
      int(r.GetMediaTrackInfo_Value(tr, "I_SOLO"))
end

-- The <FXCHAIN block of a track chunk, without its first and last lines.
function tracks.fxChain(chunk)
  local lines, inside, depth = {}, false, 0
  for line in chunk:gmatch("[^\r\n]+") do
    local trimmed = line:match("^%s*(.-)%s*$")
    if not inside and trimmed:match("^<FXCHAIN") then
      inside, depth = true, 1
    elseif inside then
      if trimmed:sub(1, 1) == "<" then depth = depth + 1 elseif trimmed == ">" then depth = depth - 1 end
      if depth == 0 then return table.concat(lines, "\n") .. "\n" end
      lines[#lines + 1] = trimmed
    end
  end
  return nil
end

return tracks
