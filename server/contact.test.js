import test from "node:test";
import assert from "node:assert/strict";
import { contactValidationError } from "../shared/contact.js";
const question = { name: "Анна", message: "Как выбрать ручку?" };
test("question requires a usable reply contact", () => {
  for (const contact of [{}, { phone: "  ", email: " " }, { phone: "123" }, { phone: "abcdefghij" }, { email: "anna@" }]) {
    assert.notEqual(contactValidationError({ ...question, ...contact }), "");
  }
});
test("question accepts phone or email independently and both together", () => {
  for (const contact of [{ phone: "+7 (978) 287-07-44" }, { email: "anna@example.com" }, { phone: "+79782870744", email: "anna@example.com" }]) {
    assert.equal(contactValidationError({ ...question, ...contact }), "");
  }
});
test("question rejects blank name and message and empty payloads", () => {
  for (const body of [null, {}, { ...question, name: " ", email: "anna@example.com" }, { ...question, message: " ", email: "anna@example.com" }]) {
    assert.notEqual(contactValidationError(body), "");
  }
});
