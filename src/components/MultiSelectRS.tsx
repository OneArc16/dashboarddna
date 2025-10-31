import React from "react";
import Select, {
  components,
  type GroupBase,
  type MenuListProps,
  type OptionProps,
  type MultiValue,
} from "react-select";

export type RSOption = { value: string; label: string };

type Props = {
  label?: string;
  placeholder?: string;
  options: RSOption[];
  value: RSOption[];                        // opciones seleccionadas
  onChange: (val: RSOption[]) => void;
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
      {/* Header: Marcar todos */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={allChecked}
          ref={(el) => {
            if (el) el.indeterminate = someChecked;
          }}
          onChange={(e) => {
            if (e.target.checked) {
              props.setValue(allOptions as any, "select-option");
            } else {
              props.setValue([], "deselect-option");
            }
          }}
        />
        <span style={{ fontSize: 12 }}>Marcar todos ({allOptions.length})</span>
      </div>

      {/* Lista de opciones */}
      {props.children}

      {/* Footer: Limpiar / Listo */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", gap: 8 }}>
        <button
          type="button"
          onClick={() => props.setValue([], "deselect-option")}
          className="px-2 py-1 text-sm border rounded"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={() => props.selectProps.onMenuClose?.()}
          className="px-3 py-1 text-sm text-white bg-black rounded"
        >
          Listo
        </button>
      </div>
    </components.MenuList>
  );
};

export default function MultiSelectRS({
  label,
  placeholder = "Selecciona…",
  options,
  value,
  onChange,
}: Props) {
  return (
    <div className="w-full">
      {label && <label className="block mb-1 text-sm text-slate-700">{label}</label>}
      <Select<RSOption, true>
        isMulti
        options={options}
        value={value}
        onChange={(val) => onChange(val as MultiValue<RSOption> as RSOption[])}
        classNamePrefix="rs"
        closeMenuOnSelect={false}
        hideSelectedOptions={false}
        placeholder={placeholder}
        components={{ Option: CheckboxOption, MenuList }}
        styles={{
          menu: (s) => ({ ...s, zIndex: 40 }),
        }}
      />
    </div>
  );
}
