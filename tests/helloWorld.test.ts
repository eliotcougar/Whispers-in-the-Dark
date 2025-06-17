import { describe, it, expect } from 'vitest';

describe('helloWorld', () => {
    it('should return "Hello, World!"', () => {
        const result = helloWorld();
        expect(result).toBe('Hello, World!');
    });
});
function helloWorld() {
    return 'Hello, World!';
}
