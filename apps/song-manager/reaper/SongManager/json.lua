-- Minimal JSON for the Song Manager bridge. Reaper's Lua has no JSON library.
-- Objects encode with sorted keys, so the same state always encodes to the same string.
-- Arrays: tables made with json.array(), or any non-empty sequence.

local json = {}

local ARRAY = {}
json.null = setmetatable({}, { __tostring = function() return "null" end })

function json.array(t)
  return setmetatable(t or {}, ARRAY)
end

local escapes = { ['"'] = '\\"', ['\\'] = '\\\\', ['\b'] = '\\b', ['\f'] = '\\f', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t' }

local function encodeString(s)
  return '"' .. s:gsub('[%c"\\]', function(c)
    return escapes[c] or string.format('\\u%04x', c:byte())
  end) .. '"'
end

local function encodeNumber(n)
  if n ~= n or n == math.huge or n == -math.huge then return "null" end
  if math.type(n) == "integer" then return tostring(n) end
  if n == math.floor(n) and math.abs(n) < 2 ^ 53 then return string.format("%d", n) end
  return string.format("%.14g", n)
end

local function isArray(t)
  if getmetatable(t) == ARRAY then return true end
  local n = #t
  if n == 0 then return false end
  for k in pairs(t) do
    if math.type(k) ~= "integer" or k < 1 or k > n then return false end
  end
  return true
end

local encode

local function encodeTable(t)
  if isArray(t) then
    local parts = {}
    for i = 1, #t do parts[i] = encode(t[i]) end
    return "[" .. table.concat(parts, ",") .. "]"
  end
  local keys = {}
  for k in pairs(t) do
    if type(k) ~= "string" then error("json: object keys must be strings") end
    keys[#keys + 1] = k
  end
  table.sort(keys)
  local parts = {}
  for i, k in ipairs(keys) do parts[i] = encodeString(k) .. ":" .. encode(t[k]) end
  return "{" .. table.concat(parts, ",") .. "}"
end

encode = function(v)
  local kind = type(v)
  if v == nil or v == json.null then return "null" end
  if kind == "boolean" then return tostring(v) end
  if kind == "number" then return encodeNumber(v) end
  if kind == "string" then return encodeString(v) end
  if kind == "table" then return encodeTable(v) end
  error("json: can't encode a " .. kind)
end

json.encode = encode

-- Decoding

local function decodeError(s, i, what)
  error(string.format("json: %s at character %d", what, i), 0)
end

local function skip(s, i)
  return s:find("[^ \t\r\n]", i) or #s + 1
end

local decodeValue

local function utf8char(code)
  return utf8.char(code)
end

local function decodeString(s, i)
  local out, j = {}, i + 1
  while true do
    local c = s:sub(j, j)
    if c == "" then decodeError(s, j, "unterminated string") end
    if c == '"' then return table.concat(out), j + 1 end
    if c == "\\" then
      local e = s:sub(j + 1, j + 1)
      local simple = { ['"'] = '"', ['\\'] = '\\', ['/'] = '/', b = '\b', f = '\f', n = '\n', r = '\r', t = '\t' }
      if simple[e] then
        out[#out + 1] = simple[e]
        j = j + 2
      elseif e == "u" then
        local hex = s:sub(j + 2, j + 5)
        if not hex:match("^%x%x%x%x$") then decodeError(s, j, "bad \\u escape") end
        local code = tonumber(hex, 16)
        j = j + 6
        if code >= 0xD800 and code <= 0xDBFF and s:sub(j, j + 1) == "\\u" then
          local low = tonumber(s:sub(j + 2, j + 5), 16)
          if low and low >= 0xDC00 and low <= 0xDFFF then
            code = 0x10000 + (code - 0xD800) * 0x400 + (low - 0xDC00)
            j = j + 6
          end
        end
        out[#out + 1] = utf8char(code)
      else
        decodeError(s, j, "bad escape")
      end
    else
      out[#out + 1] = c
      j = j + 1
    end
  end
end

local function decodeNumber(s, i)
  local text = s:match("^-?%d+%.?%d*[eE]?[-+]?%d*", i)
  if not text or text == "" or text == "-" then decodeError(s, i, "bad number") end
  local n = math.tointeger(tonumber(text)) or tonumber(text)
  if n == nil then decodeError(s, i, "bad number") end
  return n, i + #text
end

local function decodeArray(s, i)
  local out = json.array()
  i = skip(s, i + 1)
  if s:sub(i, i) == "]" then return out, i + 1 end
  while true do
    local v
    v, i = decodeValue(s, i)
    out[#out + 1] = v
    i = skip(s, i)
    local c = s:sub(i, i)
    if c == "]" then return out, i + 1 end
    if c ~= "," then decodeError(s, i, "expected , or ]") end
    i = skip(s, i + 1)
  end
end

local function decodeObject(s, i)
  local out = {}
  i = skip(s, i + 1)
  if s:sub(i, i) == "}" then return out, i + 1 end
  while true do
    if s:sub(i, i) ~= '"' then decodeError(s, i, "expected a key") end
    local k
    k, i = decodeString(s, i)
    i = skip(s, i)
    if s:sub(i, i) ~= ":" then decodeError(s, i, "expected :") end
    local v
    v, i = decodeValue(s, skip(s, i + 1))
    out[k] = v
    i = skip(s, i)
    local c = s:sub(i, i)
    if c == "}" then return out, i + 1 end
    if c ~= "," then decodeError(s, i, "expected , or }") end
    i = skip(s, i + 1)
  end
end

local literals = { ["true"] = true, ["false"] = false }

decodeValue = function(s, i)
  i = skip(s, i)
  local c = s:sub(i, i)
  if c == "{" then return decodeObject(s, i) end
  if c == "[" then return decodeArray(s, i) end
  if c == '"' then return decodeString(s, i) end
  if c == "-" or c:match("%d") then return decodeNumber(s, i) end
  for word, value in pairs(literals) do
    if s:sub(i, i + #word - 1) == word then return value, i + #word end
  end
  if s:sub(i, i + 3) == "null" then return json.null, i + 4 end
  decodeError(s, i, "unexpected character")
end

function json.decode(s)
  local v, i = decodeValue(s, 1)
  if skip(s, i) <= #s then decodeError(s, i, "trailing characters") end
  return v
end

return json
