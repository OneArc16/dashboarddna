import { useMemo, useState } from "react";
import type { RefObject } from "react";

type FieldErrors<T extends string> = Partial<Record<T, string>>;

type UseAgendaValidationOptions<T extends string> = {
  errors: FieldErrors<T>;
  fieldOrder: T[];
  fieldRefs: Partial<Record<T, RefObject<HTMLElement | null>>>;
};

export function useAgendaValidation<T extends string>({
  errors,
  fieldOrder,
  fieldRefs,
}: UseAgendaValidationOptions<T>) {
  const [touched, setTouched] = useState<Partial<Record<T, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const visibleErrors = useMemo(() => {
    return fieldOrder.reduce<FieldErrors<T>>((accumulator, field) => {
      if ((submitted || touched[field]) && errors[field]) {
        accumulator[field] = errors[field];
      }
      return accumulator;
    }, {});
  }, [errors, fieldOrder, submitted, touched]);

  const markTouched = (field: T) => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

  const resetValidation = () => {
    setTouched({});
    setSubmitted(false);
  };

  const validate = () => {
    setSubmitted(true);

    const firstInvalidField = fieldOrder.find((field) => errors[field]);
    if (!firstInvalidField) return true;

    const element = fieldRefs[firstInvalidField]?.current;
    if (element) {
      requestAnimationFrame(() => {
        element.focus();
        element.scrollIntoView({
          block: "center",
          inline: "nearest",
        });
      });
    }

    return false;
  };

  const getFieldError = (field: T) => visibleErrors[field];

  return {
    getFieldError,
    markTouched,
    resetValidation,
    validate,
    visibleErrors,
    hasVisibleErrors: Object.keys(visibleErrors).length > 0,
  };
}
