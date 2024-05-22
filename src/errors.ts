export class NgxBaseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'NgxBaseError'
  }
}

export class NgxInputError extends NgxBaseError {
  constructor(
    message: string,
    readonly value: unknown,
    options?: ErrorOptions,
  ) {
    super(`${message}: ${ellipsis(JSON.stringify(value), 42)}`, options)
    this.name = 'NgxInputError'
  }
}

function ellipsis(text: string, maxLength: number): string {
  if (text.length > maxLength) {
    return `${text.slice(0, maxLength)}...`
  }
  return text
}
