type ValidatorArg = object | undefined | null;

type ValidatorFunc = (obj: ValidatorArg) => (string | undefined);

type ValidatorMap = Record<string, ValidatorFunc[]>;