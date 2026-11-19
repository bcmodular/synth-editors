// npm run fake:x32: the fake desk on its own, for trying the app by hand before the real one arrives. Point the app
// at it with `X32_HOST=127.0.0.1:10023 npm run dev:x32`, or type 127.0.0.1:10023 into the address field.
import { FakeX32 } from "./fakeX32.ts";

const port = Number(process.env.X32_FAKE_PORT ?? 10023);
const fake = await FakeX32.start({}, port);
console.log(`Fake X32 Rack listening on ${fake.host}. Ctrl-C to stop.`);
process.on("SIGINT", () => void fake.stop().then(() => process.exit(0)));
