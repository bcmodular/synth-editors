-- A stand-in for the parts of the reaper API the bridge uses, so the bridge can be tested with plain Lua.
-- Like Reaper, changing arm, mute or solo doesn't move the project state change count.

local Mock = {}

local function newTrack(n)
  return {
    guid = string.format("{0000000%d-AAAA-BBBB-CCCC-DDDDDDDDDDDD}", n),
    values = { I_RECINPUT = -1, I_RECMODE = 0, I_RECMON = 1, I_MIDIHWOUT = -1, I_RECARM = 0, B_MUTE = 0, I_SOLO = 0 },
    strings = { P_NAME = "" },
    recFx = {},
    chunk = "<TRACK\nNAME x\n<FXCHAIN\nSHOW 0\n<VST \"VST: Synth\" synth.vst3\nAAAA\n>\n>\n>\n",
  }
end

function Mock.new()
  local m = {
    ext = {}, tracks = {}, changeCount = 0, now = 0, playState = 0, tempo = 120,
    inputs = { [0] = "H12MIDI-Pro Port 1", [2] = "H12MIDI-Pro Port 3" },
    outputs = { [0] = "H12MIDI-Pro Port 1", [1] = "H12MIDI-Pro Port 2", [40] = "Far Away Port" },
    calls = {}, sent = {}, nextGuid = 1, deleted = {},
  }
  local r = {}
  m.r = r
  local function touch() m.changeCount = m.changeCount + 1 end
  local function log(name) m.calls[#m.calls + 1] = name end

  function m.addTrack(name)
    local t = newTrack(m.nextGuid)
    m.nextGuid = m.nextGuid + 1
    t.strings.P_NAME = name or ""
    m.tracks[#m.tracks + 1] = t
    touch()
    return t
  end

  r.time_precise = function() return m.now end
  r.SetExtState = function(s, k, v) m.ext[s .. "/" .. k] = v end
  r.GetExtState = function(s, k) return m.ext[s .. "/" .. k] or "" end
  r.DeleteExtState = function(s, k) m.ext[s .. "/" .. k] = nil end
  r.EnumProjects = function() return "project-1", "" end
  r.GetProjectStateChangeCount = function() return m.changeCount end
  r.CountTracks = function() return #m.tracks end
  r.GetTrack = function(_, i) return m.tracks[i + 1] end
  r.GetTrackGUID = function(t) return t.guid end
  r.ValidatePtr2 = function(_, t) return not m.deleted[t] end
  r.GetMediaTrackInfo_Value = function(t, key) return t.values[key] + 0.0 end
  r.SetMediaTrackInfo_Value = function(t, key, v) t.values[key] = v; touch(); return true end
  r.GetSetMediaTrackInfo_String = function(t, key, v, set)
    if set then t.strings[key] = v; touch(); return true, v end
    return true, t.strings[key] or ""
  end
  r.GetNumMIDIInputs = function() return 64 end
  r.GetNumMIDIOutputs = function() return 64 end
  r.GetMIDIInputName = function(i) return m.inputs[i] ~= nil, m.inputs[i] or "" end
  r.GetMIDIOutputName = function(i) return m.outputs[i] ~= nil, m.outputs[i] or "" end
  r.GetPlayState = function() return m.playState end
  r.Master_GetTempo = function() return m.tempo end
  r.InsertTrackAtIndex = function(i)
    local t = newTrack(m.nextGuid)
    m.nextGuid = m.nextGuid + 1
    table.insert(m.tracks, i + 1, t)
    touch()
  end
  r.DeleteTrack = function(t)
    for i, x in ipairs(m.tracks) do if x == t then table.remove(m.tracks, i) end end
    m.deleted[t] = true
    touch()
  end
  r.CSurf_OnRecArmChangeEx = function(t, v) t.values.I_RECARM = v; return true end
  r.CSurf_OnMuteChangeEx = function(t, v) t.values.B_MUTE = v; return true end
  r.CSurf_OnSoloChangeEx = function(t, v) t.values.I_SOLO = v; return true end
  r.TrackFX_AddByName = function(t, name, rec, instantiate)
    if name ~= "JS:Song Manager note filter" then return -1 end
    if t.recFx[1] then return 0 end
    if instantiate > 0 then t.recFx[1] = { -1, -1, -1, -1, -1, -1, -1, -1 }; touch(); return 0 end
    return -1
  end
  r.TrackFX_GetParam = function(t, fx, p) return t.recFx[fx - 0x1000000 + 1][p + 1] + 0.0, -1, 127 end
  r.TrackFX_SetParam = function(t, fx, p, v) t.recFx[fx - 0x1000000 + 1][p + 1] = v; touch(); return true end
  r.TrackFX_Delete = function(t, fx) table.remove(t.recFx, fx - 0x1000000 + 1); touch(); return true end
  r.StuffMIDIMessage = function(mode, a, b, c) m.sent[#m.sent + 1] = { mode, a, b, c } end
  r.TimeMap2_beatsToTime = function(_, beats, measures) return measures * 2 + beats end
  r.AddProjectMarker2 = function(_, _, pos, _, name) m.marker = { pos = pos, name = name }; touch(); return 1 end
  r.GetTrackStateChunk = function(t) return true, t.chunk end
  r.PreventUIRefresh = function() end
  r.Undo_BeginBlock2 = function() log("undo-begin") end
  r.Undo_EndBlock2 = function(_, desc) log("undo-end " .. desc) end
  return m
end

return Mock
