-- base64url decoding (RFC 4648 §5, padding optional). Commands arrive base64url-encoded, so no "/", ";" or "%"
-- ever reaches the web interface's command parser.

local base64 = {}

local alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
local values = {}
for i = 1, #alphabet do values[alphabet:sub(i, i)] = i - 1 end
values["+"] = 62
values["/"] = 63

function base64.decode(text)
  text = text:gsub("=+$", "")
  local out, bits, count = {}, 0, 0
  for i = 1, #text do
    local v = values[text:sub(i, i)]
    if v == nil then error("base64: bad character at " .. i, 0) end
    bits = (bits << 6) | v
    count = count + 6
    if count >= 8 then
      count = count - 8
      out[#out + 1] = string.char((bits >> count) & 0xFF)
    end
  end
  return table.concat(out)
end

function base64.encode(data)
  local out = {}
  for i = 1, #data, 3 do
    local a, b, c = data:byte(i, i + 2)
    local n = (a << 16) | ((b or 0) << 8) | (c or 0)
    local chars = 2 + (b and 1 or 0) + (c and 1 or 0)
    for k = 1, chars do
      local index = (n >> (18 - 6 * (k - 1))) & 63
      out[#out + 1] = alphabet:sub(index + 1, index + 1)
    end
  end
  return table.concat(out)
end

return base64
