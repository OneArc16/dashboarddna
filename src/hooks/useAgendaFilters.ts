import { startTransition, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import type { ParsedUrlQuery } from "querystring";

type QueryStateConfig<T> = {
  state: T;
  parse: (query: ParsedUrlQuery) => T;
  serialize: (state: T) => URLSearchParams;
  apply: (next: T) => void;
};

type OptionLike = {
  value: string;
  label: string;
};

const getFirstValue = (value?: string | string[]) => {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
};

export const parseQueryValue = (query: ParsedUrlQuery, key: string) =>
  getFirstValue(query[key]);

export const parseQueryCsv = (query: ParsedUrlQuery, key: string) =>
  getFirstValue(query[key])
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

export const parseQueryLimit = (query: ParsedUrlQuery, key: string) => {
  const value = getFirstValue(query[key]);

  if (!value) return "";
  if (value === "ALL") return "ALL";

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : "";
};

export const toQueryParams = (
  entries: Array<[key: string, value: string | number | null | undefined]>,
) => {
  const params = new URLSearchParams();

  for (const [key, value] of entries) {
    if (value == null) continue;

    const normalizedValue = String(value).trim();
    if (!normalizedValue) continue;

    params.set(key, normalizedValue);
  }

  return params;
};

export const createOptionPlaceholders = (values: string[]): OptionLike[] =>
  values.map((value) => ({
    value,
    label: value,
  }));

export const normalizeSelectedOptions = <T extends OptionLike>(
  values: T[],
  options: T[],
) => {
  if (values.length === 0 || options.length === 0) return values;

  const nextByValue = new Map(options.map((option) => [option.value, option]));

  return values
    .map((item) => nextByValue.get(item.value) ?? item)
    .filter((item, index, array) => array.findIndex((entry) => entry.value === item.value) === index);
};

export const filterSelectedOptions = <T extends OptionLike>(values: T[], options: T[]) => {
  if (values.length === 0) return values;

  const allowedValues = new Set(options.map((option) => option.value));
  return values.filter((item) => allowedValues.has(item.value));
};

export const getOptionValues = <T extends OptionLike>(values: T[]) =>
  values.map((item) => item.value).filter(Boolean);

const buildRouterQuery = (params: URLSearchParams) => {
  const nextQuery: Record<string, string> = {};

  params.forEach((value, key) => {
    nextQuery[key] = value;
  });

  return nextQuery;
};

export function useAgendaFilters<T>({
  state,
  parse,
  serialize,
  apply,
}: QueryStateConfig<T>) {
  const router = useRouter();
  const hydratedRef = useRef(false);
  const lastQueryRef = useRef("");
  const currentQueryString = serialize(state).toString();

  useEffect(() => {
    if (!router.isReady || hydratedRef.current) return;

    const parsedState = parse(router.query);
    const initialQuery = serialize(parsedState).toString();

    apply(parsedState);
    lastQueryRef.current = initialQuery;
    hydratedRef.current = true;
  }, [apply, parse, router.isReady, router.query, serialize]);

  useEffect(() => {
    if (!router.isReady || !hydratedRef.current) return;

    if (currentQueryString === lastQueryRef.current) return;

    lastQueryRef.current = currentQueryString;
    const nextParams = new URLSearchParams(currentQueryString);

    startTransition(() => {
      router.replace(
        currentQueryString
          ? {
              pathname: router.pathname,
              query: buildRouterQuery(nextParams),
            }
          : { pathname: router.pathname },
        undefined,
        { shallow: true, scroll: false },
      );
    });
  }, [currentQueryString, router]);

  return {
    hasQueryState: currentQueryString.length > 0,
  };
}
