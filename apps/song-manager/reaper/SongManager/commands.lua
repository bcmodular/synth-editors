-- The bridge's command set. Each handler gets (ctx, cmd) and returns its result data (or nil);
-- it raises an error with a plain message when the command can't be done.
-- ctx: r (the reaper API), track(guid) → MediaTrack, ports() → the scanned MIDI ports.

local json = require("json")
local tracks = require("tracks")

local commands = {}

-- Commands that change nothing in the project run without an undo block.
commands.readOnly = { ["get-state"] = true, ["notes-off"] = true, ["save-fx-chain"] = true, ["ping"] = true }

local function setInfo(r, tr, key, value)
  r.GetSetMediaTrackInfo_String(tr, key, value, true)
end

local function bool(v, what)
  if type(v) ~= "boolean" then error(what .. " needs on: true or false", 0) end
  return v
end

local H = {}

H["ping"] = function() return { pong = true } end

H["get-state"] = function() return nil end

H["create-track"] = function(ctx, c)
  local r = ctx.r
  local count = r.CountTracks(0)
  local index = math.type(c.index) == "integer" and math.max(0, math.min(c.index, count)) or count
  r.InsertTrackAtIndex(index, true)
  local tr = r.GetTrack(0, index)
  if type(c.name) == "string" then setInfo(r, tr, "P_NAME", c.name) end
  if type(c.part) == "string" then setInfo(r, tr, tracks.PART_KEY, c.part) end
  return { track = r.GetTrackGUID(tr) }
end

H["delete-track"] = function(ctx, c)
  ctx.r.DeleteTrack(ctx.track(c.track))
end

H["set-name"] = function(ctx, c)
  setInfo(ctx.r, ctx.track(c.track), "P_NAME", tostring(c.name or ""))
end

H["set-part"] = function(ctx, c)
  local part = (c.part == nil or c.part == json.null) and "" or tostring(c.part)
  setInfo(ctx.r, ctx.track(c.track), tracks.PART_KEY, part)
end

H["set-input"] = function(ctx, c)
  local tr = ctx.track(c.track)
  ctx.r.SetMediaTrackInfo_Value(tr, "I_RECINPUT", tracks.encodeInput(c.input, ctx.ports()))
end

H["set-monitor"] = function(ctx, c)
  local mode = c.mode
  if mode ~= 0 and mode ~= 1 and mode ~= 2 then error("monitor mode must be 0 (off), 1 (on) or 2 (not when playing)", 0) end
  ctx.r.SetMediaTrackInfo_Value(ctx.track(c.track), "I_RECMON", mode)
end

H["set-hw-midi-out"] = function(ctx, c)
  local tr = ctx.track(c.track)
  ctx.r.SetMediaTrackInfo_Value(tr, "I_MIDIHWOUT", tracks.encodeMidiOut(c.port, c.channel, ctx.ports()))
end

H["arm"] = function(ctx, c)
  ctx.r.CSurf_OnRecArmChangeEx(ctx.track(c.track), bool(c.on, "arm") and 1 or 0, false)
end

H["mute"] = function(ctx, c)
  ctx.r.CSurf_OnMuteChangeEx(ctx.track(c.track), bool(c.on, "mute") and 1 or 0, false)
end

H["solo"] = function(ctx, c)
  ctx.r.CSurf_OnSoloChangeEx(ctx.track(c.track), bool(c.on, "solo") and 1 or 0, false)
end

local function checkNotes(notes)
  if #notes > tracks.NOTE_FILTER_SLOTS then error("the note filter takes up to " .. tracks.NOTE_FILTER_SLOTS .. " notes", 0) end
  for _, note in ipairs(notes) do
    if math.type(note) ~= "integer" or note < 0 or note > 127 then error("notes must be 0–127", 0) end
  end
end

H["set-note-filter"] = function(ctx, c)
  local r, tr = ctx.r, ctx.track(c.track)
  local existing = tracks.findNoteFilter(r, tr, 0)
  if c.notes == nil or c.notes == json.null then
    if existing then r.TrackFX_Delete(tr, existing) end
    return nil
  end
  checkNotes(c.notes)
  local fx = existing or tracks.findNoteFilter(r, tr, 1)
  if not fx then error("note filter JSFX not found: link reaper/Effects/SongManager into Reaper's Effects folder", 0) end
  for slot = 0, tracks.NOTE_FILTER_SLOTS - 1 do
    r.TrackFX_SetParam(tr, fx, slot, c.notes[slot + 1] or -1)
  end
end

H["notes-off"] = function(ctx, c)
  local device = tracks.findPort(ctx.ports().outputs, c.port)
  local channels = type(c.channels) == "table" and c.channels or { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 }
  for _, ch in ipairs(channels) do
    ctx.r.StuffMIDIMessage(16 + device, 0xB0 + ch - 1, 123, 0)
  end
end

H["add-marker"] = function(ctx, c)
  local r = ctx.r
  local position = c.position
  if math.type(c.bar) == "integer" then position = r.TimeMap2_beatsToTime(0, 0, c.bar - 1) end
  if type(position) ~= "number" then error("add-marker needs bar (1-based) or position (seconds)", 0) end
  return { index = r.AddProjectMarker2(0, false, position, 0, tostring(c.name or ""), -1, 0) }
end

H["save-fx-chain"] = function(ctx, c)
  local ok, chunk = ctx.r.GetTrackStateChunk(ctx.track(c.track), "", false)
  if not ok then error("couldn't read the track's state", 0) end
  return { fxChain = tracks.fxChain(chunk) or json.null }
end

commands.handlers = H

function commands.run(ctx, cmd)
  local handler = H[cmd.type]
  if not handler then error("unknown command: " .. tostring(cmd.type), 0) end
  return handler(ctx, cmd)
end

return commands
