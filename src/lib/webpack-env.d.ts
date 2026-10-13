// require.context (webpack, utilisé par le bundler Remotion) : charge tous les fichiers d'un dossier.
declare namespace NodeJS {
  interface Require {
    context(directory: string, useSubdirectories: boolean, regExp: RegExp): { keys(): string[]; (key: string): unknown };
  }
}
