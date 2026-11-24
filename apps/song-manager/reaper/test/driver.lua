-- Runs the real bridge against mock_reaper.lua, one tick per input line, so the TypeScript client can be tested
-- end to end. Each line in: {"ext":{"SongManager/key":"value",…},"now":seconds}. Each line out: {"ext":{…}}.

local here = debug.getinfo(1, "S").source:match("^@(.*[/\\])") or "./"
package.path = here .. "?.lua;" .. here .. "../SongManager/?.lua;" .. package.path

local json = require("json")
local Bridge = require("bridge")
local Mock = require("mock_reaper")

local mock = Mock.new()
mock.addTrack("Existing")
local bridge = Bridge.new(mock.r)
bridge:start()

local function report()
  local ext = {}
  for k, v in pairs(mock.ext) do ext[k] = v end
  io.write(json.encode({ ext = ext }), "\n")
  io.stdout:flush()
end

report() -- the keys start() wrote, before the first tick

for line in io.lines() do
  local msg = json.decode(line)
  mock.ext = {}
  for k, v in pairs(msg.ext) do mock.ext[k] = v end
  mock.now = msg.now or mock.now
  bridge:tick()
  report()
end
