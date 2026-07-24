export function assert(condition: unknown, message = "Assertion failed."): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
    );
  }
}

export function assertThrows(
  operation: () => unknown,
  expectedMessage?: string,
): Error {
  try {
    operation();
  } catch (error) {
    if (!(error instanceof Error)) throw new Error("A non-Error value was thrown.");
    if (expectedMessage && !error.message.includes(expectedMessage)) {
      throw new Error(
        `Expected error containing "${expectedMessage}", received "${error.message}".`,
      );
    }
    return error;
  }
  throw new Error("Expected operation to throw.");
}

export async function assertRejects(
  operation: () => Promise<unknown>,
  expectedMessage?: string,
): Promise<Error> {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof Error)) throw new Error("A non-Error value was thrown.");
    if (expectedMessage && !error.message.includes(expectedMessage)) {
      throw new Error(
        `Expected error containing "${expectedMessage}", received "${error.message}".`,
      );
    }
    return error;
  }
  throw new Error("Expected operation to reject.");
}
