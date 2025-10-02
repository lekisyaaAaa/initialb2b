// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Polyfill TextEncoder/TextDecoder for Jest/node environment (used by some libs)
import { TextEncoder, TextDecoder } from 'util';
// @ts-ignore
global.TextEncoder = global.TextEncoder || TextEncoder;
// @ts-ignore
global.TextDecoder = global.TextDecoder || TextDecoder;

// jest/jsdom does not implement matchMedia; provide a minimal polyfill for prefers-color-scheme
if (typeof window !== 'undefined' && typeof (window as any).matchMedia !== 'function') {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	window.matchMedia = (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	});
}
