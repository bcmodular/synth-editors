-- @description Song Manager bridge: lets Song Manager read and drive this Reaper over the web interface
-- Run it once per session from the Actions list (or a startup action). Running it again takes over from the
-- copy already running. See apps/song-manager/README.md.

local dir = debug.getinfo(1, "S").source:match("^@(.*[/\\])") or "./"
package.path = dir .. "SongManager/?.lua;" .. package.path

local Bridge = require("bridge")
local bridge = Bridge.new(reaper)
local lastError = nil

local function loop()
  local ok, running = pcall(bridge.tick, bridge)
  if not ok then
    if running ~= lastError then reaper.ShowConsoleMsg("Song Manager bridge: " .. tostring(running) .. "\n") end
    lastError = running
    running = true
  end
  if running then reaper.defer(loop) end
end

bridge:start()
reaper.atexit(function() bridge:stop() end)
loop()
