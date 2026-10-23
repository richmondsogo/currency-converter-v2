// tests/popup-errors.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ERROR_CLASSES,
  ERROR_MESSAGES,
  getConversionErrorMessage,
  classifyConversionError
} from '../src/popup/popup-errors.js';

test('popup-errors: classifies restricted page error correctly', () => {
  const errClass = classifyConversionError({
    isRestricted: true,
    hasHostPermission: true,
    ratesAvailable: true,
    hasResponse: true
  });
  assert.equal(errClass, ERROR_CLASSES.RESTRICTED_PAGE);
  assert.equal(getConversionErrorMessage(errClass), ERROR_MESSAGES[ERROR_CLASSES.RESTRICTED_PAGE]);
});

test('popup-errors: classifies missing host permission error correctly', () => {
  const errClass = classifyConversionError({
    isRestricted: false,
    hasHostPermission: false,
    ratesAvailable: true,
    hasResponse: true
  });
  assert.equal(errClass, ERROR_CLASSES.NO_HOST_PERMISSION);
  assert.equal(getConversionErrorMessage(errClass), ERROR_MESSAGES[ERROR_CLASSES.NO_HOST_PERMISSION]);
});

test('popup-errors: classifies rates unavailable error correctly', () => {
  const errClass = classifyConversionError({
    isRestricted: false,
    hasHostPermission: true,
    ratesAvailable: false,
    hasResponse: true
  });
  assert.equal(errClass, ERROR_CLASSES.RATES_UNAVAILABLE);
  assert.equal(getConversionErrorMessage(errClass), ERROR_MESSAGES[ERROR_CLASSES.RATES_UNAVAILABLE]);
});

test('popup-errors: classifies unreachable content script error correctly', () => {
  const errClass = classifyConversionError({
    isRestricted: false,
    hasHostPermission: true,
    ratesAvailable: true,
    hasResponse: false
  });
  assert.equal(errClass, ERROR_CLASSES.CONTENT_SCRIPT_UNREACHABLE);
  assert.equal(getConversionErrorMessage(errClass), ERROR_MESSAGES[ERROR_CLASSES.CONTENT_SCRIPT_UNREACHABLE]);
});

test('popup-errors: custom error message takes precedence', () => {
  const msg = getConversionErrorMessage(ERROR_CLASSES.UNKNOWN, 'Custom scanner error');
  assert.equal(msg, 'Custom scanner error');
});
