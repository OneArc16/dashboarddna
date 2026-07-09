import React from "react";
import Select, {
  components,
  type GroupBase,
  type MenuListProps,
  type MultiValue,
  type OptionProps,
  type StylesConfig,
} from "react-select";

export type RSOption = { value: string; label: string };

type Props = {
  label?: string;
  placeholder?: string;
  options: RSOption[];
  value: RSOption[];
  onChange: (val: RSOption[]) => void;
  summaryLabel?: string;
  noOptionsMessage?: string;
  isDisabled?: boolean;
  helperText?: string;
  errorMessage?: string;
  onBlur?: () => void;
};

const CheckboxOption = (props: OptionProps<RSOption, true>) => {
  return (
    <components.Option {...props}>
      <input
        type="checkbox"
        readOnly
        checked={props.isSelected}
        className="mr-2"
      />
      {props.label}
    </components.Option>
  );
};

const MenuList = (props: MenuListProps<RSOption, true, GroupBase<RSOption>>) => {
  const allOptions = props.options as RSOption[];
  const selected = (props.selectProps.value as RSOption[]) ?? [];
  const allChecked = selected.length === allOptions.length && allOptions.length > 0;
  const someChecked = selected.length > 0 && selected.length < allOptions.length;

  return (
    <components.MenuList {...props}>
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid #e5e7eb",
          display: "grid",
          gap: 8,
          background: "#f8fafc",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.4 }}>
          Escribe para filtrar y marca varias opciones.
        </p>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={allChecked}
            ref={(element) => {
              if (element) element.indeterminate = someChecked;
            }}
            onChange={(event) => {
              if (event.target.checked) {
                props.setValue(allOptions, "select-option");
              } else {
                props.setValue([], "deselect-option");
              }
            }}
          />
          <span style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}>
            Marcar todos ({allOptions.length})
          </span>
        </label>
      </div>

      {props.children}

      <div
        style={{
          padding: "10px 12px",
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          background: "#f8fafc",
        }}
      >
        <button
          type="button"
          onClick={() => props.setValue([], "deselect-option")}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={() => props.selectProps.onMenuClose?.()}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Listo
        </button>
      </div>
    </components.MenuList>
  );
};

const selectStyles: StylesConfig<RSOption, true> = {
  control: (base, state) => {
    const isInvalid = Boolean(state.selectProps["aria-invalid"]);

    return {
      ...base,
      minHeight: 44,
      borderRadius: 14,
      borderColor: isInvalid ? "#fca5a5" : state.isFocused ? "#0891b2" : "#cbd5e1",
      boxShadow: isInvalid
        ? "0 0 0 4px rgba(239, 68, 68, 0.08)"
        : state.isFocused
          ? "0 0 0 4px rgba(8, 145, 178, 0.12)"
          : "0 1px 2px rgba(15, 23, 42, 0.04)",
      padding: "2px 6px",
      backgroundColor: state.isDisabled ? "#f1f5f9" : "#ffffff",
      transition: "border-color 150ms ease, box-shadow 150ms ease",
      cursor: state.isDisabled ? "not-allowed" : "pointer",
      "&:hover": {
        borderColor: isInvalid ? "#f87171" : state.isFocused ? "#0891b2" : "#94a3b8",
      },
    };
  },
  valueContainer: (base) => ({
    ...base,
    gap: 6,
    padding: "2px 4px",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#64748b",
  }),
  input: (base) => ({
    ...base,
    color: "#0f172a",
  }),
  multiValue: (base) => ({
    ...base,
    borderRadius: 999,
    backgroundColor: "#ecfeff",
    border: "1px solid #a5f3fc",
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "#164e63",
    fontWeight: 500,
    padding: "4px 6px",
  }),
  multiValueRemove: (base) => ({
    ...base,
    borderRadius: 999,
    color: "#0f766e",
    ":hover": {
      backgroundColor: "#a5f3fc",
      color: "#164e63",
    },
  }),
  option: (base, state) => ({
    ...base,
    display: "flex",
    alignItems: "center",
    minHeight: 40,
    backgroundColor: state.isSelected ? "#e0f2fe" : state.isFocused ? "#f8fafc" : "#ffffff",
    color: "#0f172a",
    cursor: "pointer",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 50,
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.14)",
  }),
  menuList: (base) => ({
    ...base,
    paddingTop: 0,
    paddingBottom: 0,
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "#0891b2" : "#64748b",
    ":hover": {
      color: "#0f172a",
    },
  }),
};

export default function MultiSelectRS({
  label,
  placeholder = "Selecciona...",
  options,
  value,
  onChange,
  summaryLabel,
  noOptionsMessage = "Sin coincidencias",
  isDisabled = false,
  helperText,
  errorMessage,
  onBlur,
}: Props) {
  const inputId = React.useId();
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const isInvalid = Boolean(errorMessage);
  const selectionSummary =
    value.length === 0
      ? "Sin seleccion."
      : value.length === 1
        ? `${value[0]?.label} seleccionada.`
        : `${value.length} ${summaryLabel ?? "elementos"} seleccionados.`;

  const helperLabel =
    helperText ??
    `Escribe para filtrar. ${options.length} disponible(s). ${selectionSummary}`;

  const describedBy = [helperId, isInvalid ? errorId : ""].filter(Boolean).join(" ");

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}

      <Select<RSOption, true>
        inputId={inputId}
        isMulti
        options={options}
        value={value}
        onChange={(nextValue) => onChange(nextValue as MultiValue<RSOption> as RSOption[])}
        onBlur={onBlur}
        classNamePrefix="rs"
        closeMenuOnSelect={false}
        hideSelectedOptions={false}
        placeholder={placeholder}
        components={{ Option: CheckboxOption, MenuList }}
        noOptionsMessage={() => noOptionsMessage}
        isDisabled={isDisabled}
        styles={selectStyles}
        aria-invalid={isInvalid}
        aria-describedby={describedBy}
      />

      <p id={helperId} className="mt-2 text-xs text-slate-500">
        {helperLabel}
      </p>

      {errorMessage ? (
        <p id={errorId} role="alert" className="mt-1 text-sm font-medium text-red-700">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
