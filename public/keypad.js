/* Keypad rules of the game screen, kept free of the page so that they can be tested.
   A key is a number 1-20, 25 or 'bull'; a modifier is 1 (Simple), 2 (Double) or 3 (Triple). */
(function (root) {
  'use strict';

  /** The dart recorded by a key pressed with a modifier, or null when it does not exist (Triple 25). */
  function dartFor(key, modifier) {
    if (key === 'bull') return { sector: 25, multiplier: 2 };
    if (key === 25) {
      if (modifier === 3) return null;
      return { sector: 25, multiplier: modifier === 2 ? 2 : 1 };
    }
    if (!Number.isInteger(key) || key < 1 || key > 20) return null;
    if (modifier !== 1 && modifier !== 2 && modifier !== 3) return null;
    return { sector: key, multiplier: modifier };
  }

  /** The key and modifier that record `dart`: what the keypad should blink for a checkout target. */
  function keyFor(dart) {
    if (dart.sector === 25)
      return dart.multiplier === 2 ? { key: 'bull', modifier: 1 } : { key: 25, modifier: 1 };
    return { key: dart.sector, modifier: dart.multiplier };
  }

  var api = { dartFor: dartFor, keyFor: keyFor };
  root.Keypad = api;
})(typeof window !== 'undefined' ? window : globalThis);
