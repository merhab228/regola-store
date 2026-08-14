import test from "node:test";
import assert from "node:assert/strict";
import { createDadataClient } from "./dadata.js";

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test("DaData suggestions keep the token on the server and map city/address selections", async () => {
  const calls = [];
  const cityFiasId = "c2deb16a-0330-4f05-821f-1d09c93331e6";
  const addressFiasId = "0c4a0b75-a810-4e41-b05c-3977f0477c52";
  const client = createDadataClient({ DADATA_TOKEN: "secret-token" }, {
    fetchImpl: async (url, options) => {
      calls.push({ url, options, body: JSON.parse(options.body) });
      if (calls.length === 1) {
        return response({ suggestions: [{ value: "г Санкт-Петербург", data: { city_with_type: "г Санкт-Петербург", city_fias_id: cityFiasId } }] });
      }
      return response({ suggestions: [{ value: "г Санкт-Петербург, пр-кт Героев, д 26", data: { fias_id: addressFiasId, house: "26" } }] });
    },
  });

  const cities = await client.suggest({ kind: "city", query: "санкт" });
  const addresses = await client.suggest({ kind: "address", query: "героев 26", cityFiasId });

  assert.equal(cities[0].fiasId, cityFiasId);
  assert.equal(addresses[0].fiasId, addressFiasId);
  assert.equal(addresses[0].hasHouse, true);
  assert.equal(calls[0].options.headers.Authorization, "Token secret-token");
  assert.deepEqual(calls[1].body.locations, [{ fias_id: cityFiasId }]);
});
