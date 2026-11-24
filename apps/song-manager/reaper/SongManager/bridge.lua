-- The Song Manager bridge loop. Song Manager reads and writes these ExtState keys over Reaper's web interface
-- (GET/EXTSTATE and SET/EXTSTATE), all in the "SongManager" section and none persisted:
--   alive      script: a counter, bumped once a second
--   state_seq  script: "<session>-<n>", changes whenever state changes
--   state      script: one line of JSON (tracks keyed by GUID, play state, tempo, MIDI ports)
--   cmd        app:    one command, base64url JSON (plain JSON also accepted), with an id
--   result     script: {id, ok, data?, error?} for the last command, written after the new state
--   instance   script: the running copy's token; a second copy takes over and the first one stops

local json = require("json")
local base64 = require("base64")
local tracks = require("tracks")
local commands = require("commands")

local SECTION = "SongManager"

local Bridge = {}
Bridge.__index = Bridge
Bridge.SECTION = SECTION

function Bridge.new(r)
  local self = setmetatable({ r = r, seq = 0, list = {}, byGuid = {}, dirty = true, lastAlive = -math.huge, aliveCount = 0 }, Bridge)
  self.instance = string.format("%.6f", r.time_precise())
  self.session = self.instance:gsub("%.", "")
  return self
end

function Bridge:set(key, value) self.r.SetExtState(SECTION, key, value, false) end
function Bridge:get(key) return self.r.GetExtState(SECTION, key) end
function Bridge:delete(key) self.r.DeleteExtState(SECTION, key, false) end

function Bridge:start()
  self:set("instance", self.instance)
  self:delete("cmd")
  self:delete("result")
end

function Bridge:stop()
  if self:get("instance") ~= self.instance then return end
  for _, key in ipairs({ "alive", "state", "state_seq", "result", "instance" }) do self:delete(key) end
end

-- One pass of the defer loop. Returns false once another copy of the script has taken over.
function Bridge:tick()
  if self:get("instance") ~= self.instance then return false end
  self:heartbeat()
  local result = self:takeCommand()
  self:refresh()
  if result then self:set("result", json.encode(result)) end
  return true
end

function Bridge:heartbeat()
  local now = self.r.time_precise()
  if now - self.lastAlive < 1 then return end
  self.lastAlive = now
  self.aliveCount = self.aliveCount + 1
  self:set("alive", tostring(self.aliveCount))
end

-- Tracks and ports

function Bridge:rebuild()
  local r = self.r
  self.ports = tracks.scanPorts(r)
  self.list, self.byGuid = {}, {}
  for i = 0, r.CountTracks(0) - 1 do
    local tr = r.GetTrack(0, i)
    local info = tracks.read(r, tr, self.ports)
    self.list[#self.list + 1] = { tr = tr, info = info }
    self.byGuid[info.guid:upper()] = tr
  end
end

function Bridge:structureChanged()
  local project = self.r.EnumProjects(-1)
  local count = self.r.GetProjectStateChangeCount(project)
  local changed = self.dirty or project ~= self.project or count ~= self.changeCount
  self.dirty, self.project, self.changeCount = false, project, count
  return changed
end

function Bridge:allValid()
  for _, item in ipairs(self.list) do
    if not self.r.ValidatePtr2(0, item.tr, "MediaTrack*") then return false end
  end
  return true
end

local function portNames(list)
  local names = json.array()
  for i, port in ipairs(list) do names[i] = port.name end
  return names
end

function Bridge:snapshot()
  local r = self.r
  local list = json.array()
  for i, item in ipairs(self.list) do
    local info = item.info
    info.index = i
    info.arm, info.mute, info.solo = tracks.flags(r, item.tr)
    list[i] = info
  end
  local play = r.GetPlayState()
  return {
    tracks = list,
    playing = play & 1 ~= 0,
    paused = play & 2 ~= 0,
    recording = play & 4 ~= 0,
    tempo = r.Master_GetTempo(),
    ports = { inputs = portNames(self.ports.inputs), outputs = portNames(self.ports.outputs) },
  }
end

-- Rebuilds the track list when the project changed, reads arm, mute and solo on every track (every tick: they
-- don't always move the change count), and publishes the state if anything differs.
function Bridge:refresh()
  if self:structureChanged() or not self:allValid() then self:rebuild() end
  local encoded = json.encode(self:snapshot())
  if encoded == self.published then return end
  self.published = encoded
  self.seq = self.seq + 1
  self:set("state", encoded)
  self:set("state_seq", self.session .. "-" .. self.seq)
end

-- Commands

function Bridge:findTrack(guid)
  if type(guid) ~= "string" then error("this command needs track: a track GUID", 0) end
  local key = guid:upper()
  local tr = self.byGuid[key]
  if tr and self.r.ValidatePtr2(0, tr, "MediaTrack*") then return tr end
  self:rebuild()
  tr = self.byGuid[key]
  if tr then return tr end
  error("track not found: " .. guid, 0)
end

function Bridge:context()
  return {
    r = self.r,
    track = function(guid) return self:findTrack(guid) end,
    ports = function()
      self.ports = tracks.scanPorts(self.r)
      return self.ports
    end,
  }
end

local function decodeCommand(raw)
  local text = raw:sub(1, 1) == "{" and raw or base64.decode(raw)
  local cmd = json.decode(text)
  if type(cmd) ~= "table" or type(cmd.type) ~= "string" then error("a command needs a type", 0) end
  return cmd
end

function Bridge:runWithUndo(cmd)
  local r, ctx = self.r, self:context()
  if commands.readOnly[cmd.type] then return pcall(commands.run, ctx, cmd) end
  r.PreventUIRefresh(1)
  r.Undo_BeginBlock2(0)
  local ok, data = pcall(commands.run, ctx, cmd)
  r.Undo_EndBlock2(0, "Song Manager: " .. cmd.type, -1)
  r.PreventUIRefresh(-1)
  return ok, data
end

-- Takes the waiting command, if any, runs it and returns its result.
function Bridge:takeCommand()
  local raw = self:get("cmd")
  if raw == "" then return nil end
  self:delete("cmd")
  self.dirty = true
  local decoded, cmd = pcall(decodeCommand, raw)
  if not decoded then return { id = json.null, ok = false, error = "couldn't read the command: " .. tostring(cmd) } end
  local id = cmd.id == nil and json.null or cmd.id
  local ok, data = self:runWithUndo(cmd)
  if ok then return { id = id, ok = true, data = data == nil and json.null or data } end
  return { id = id, ok = false, error = tostring(data) }
end

return Bridge
