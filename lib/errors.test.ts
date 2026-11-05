import { expect, test } from "vitest";
import { toCariError } from "./errors";

test.each([
  [{ message: "invite_invalid" }, "inviteInvalid"],
  [{ message: "invite_expired" }, "inviteExpired"],
  [{ message: "last_owner" }, "lastOwner"],
  [{ message: "entry_invalid" }, "alreadyFinished"],
  [{ code: "23505", message: "dup" }, "duplicateItem"],
  [new Error("x"), "genericError"],
  [null, "genericError"],
])("%o → %s", (e, k) => expect(toCariError(e)).toBe(k));
