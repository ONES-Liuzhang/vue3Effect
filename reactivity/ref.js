import { track, trigger } from "./effect.js";

export function ref(val) {
  const r = {
    _isRef: true,
    _value: val,
    get value() {
      track(r, "value");
      return this._value;
    },
    set value(v) {
      this._value = v;
      trigger(r, "value");
    },
  };

  return r;
}
