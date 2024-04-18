type ValidatorFunc = (obj: unknown) => (string | undefined);

type ValidatorMap = Record<string, ValidatorFunc[]>;