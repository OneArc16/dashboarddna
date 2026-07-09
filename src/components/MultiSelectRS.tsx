import React from "react";
import Select, {
  components,
  type GroupBase,
  type MenuListProps,
  type OptionProps,
  type MultiValue,
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
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#f8fafc",
        }}
      >
        <input
          type="checkbox"
          checked={allChecked}
          ref={(el) => {
            if (el) el.indeterminate = someChecked;
          }}
          onChange={(e) => {
            if (e.target.checked) {
              props.setValue(allOptions, "select-option");
            } else {
              props.setValue([], "deselect-option");
            }
          }}
        />
        <span style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}>
          Marcar todos ({allOptions.length})
        </span>
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
  control: (base, state) => ({
    ...base,
    minHeight: 44,
    borderRadius: 14,
    borderColor: state.isFocused ? "#0891b2" : "#cbd5e1",
    boxShadow: state.isFocused ? "0 0 0 4px rgba(8, 145, 178, 0.12)" : "0 1px 2px rgba(15, 23, 42, 0.04)",
    padding: "2px 6px",
    backgroundColor: state.isDisabled ? "#f1f5f9" : "#ffffff",
    transition: "border-color 150ms ease, box-shadow 150ms ease",
    cursor: state.isDisabled ? "not-allowed" : "pointer",
    "&:hover": {
      borderColor: state.isFocused ? "#0891b2" : "#94a3b8",
    },
  }),
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
    backgroundColor: state.isSelected
      ? "#e0f2fe"
      : state.isFocused
        ? "#f8fafc"
        : "#ffffff",
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
  placeholder = "Selecciona…",
  options,
  value,
  onChange,
  summaryLabel,
  noOptionsMessage = "Sin coincidencias",
  isDisabled = false,
}: Props) {
  const inputId = React.useId();
  const helperText = value.length === 0
    ? "Sin selección"
    : value.length === 1
      ? value[0]?.label
      : `${value.length} ${summaryLabel ?? "elementos"} seleccionados`;

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
        onChange={(val) => onChange(val as MultiValue<RSOption> as RSOption[])}
        classNamePrefix="rs"
        closeMenuOnSelect={false}
        hideSelectedOptions={false}
        placeholder={placeholder}
        components={{ Option: CheckboxOption, MenuList }}
        noOptionsMessage={() => noOptionsMessage}
        isDisabled={isDisabled}
        styles={selectStyles}
      />
      <p className="mt-2 text-xs text-slate-500">{helperText}</p>
    </div>
  );
}
