import { generateRandomString, uuidv7 } from "./generate";

export const crypto = {
  generate: {
    string: generateRandomString,
    uuid: uuidv7,
  },
};
