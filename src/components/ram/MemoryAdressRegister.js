import { RegisterNBit } from "../registers";

export class AddressRegister extends RegisterNBit {
  constructor(sim, options) {
    super(sim, {
      ...options,
      prefix: options.prefix ?? "mar",
      bitWidth: 4,
    });
  }
}
