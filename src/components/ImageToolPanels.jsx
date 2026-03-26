import { sharedToolPageStyles } from "./imageToolWorkspaceStyles.js";

const DEFAULT_EDIT_MODES = [
  ["erase", "擦除"],
  ["restore", "恢复"],
  ["view", "查看"],
];

export function EditModeSelector({
  mode,
  disabled,
  onChange,
  title = "修边模式",
  options = DEFAULT_EDIT_MODES,
}) {
  return (
    <div>
      <div style={sharedToolPageStyles.label}>{title}</div>
      <div style={sharedToolPageStyles.modeGrid}>
        {options.map(([value, label]) => {
          const active = mode === value;
          return (
            <button
              key={value}
              onClick={() => onChange(value)}
              disabled={disabled}
              style={{
                ...sharedToolPageStyles.modeButton,
                ...(active ? sharedToolPageStyles.modeButtonActive : sharedToolPageStyles.modeButtonIdle),
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StatusCard({ title = "状态", body }) {
  return (
    <div style={sharedToolPageStyles.infoCard}>
      <div style={sharedToolPageStyles.infoTitle}>{title}</div>
      <div style={sharedToolPageStyles.infoBody}>{body}</div>
    </div>
  );
}

export function SelfTestCard({ tests, title = "内置自检" }) {
  const passedCount = tests.filter((item) => item.pass).length;

  return (
    <div style={sharedToolPageStyles.infoCard}>
      <div style={sharedToolPageStyles.rowBetween}>
        <span style={sharedToolPageStyles.infoTitle}>{title}</span>
        <span style={sharedToolPageStyles.smallMuted}>
          {passedCount}/{tests.length} 通过
        </span>
      </div>
      <div style={sharedToolPageStyles.stackSmall}>
        {tests.map((test) => (
          <div key={test.name} style={sharedToolPageStyles.testItem}>
            <div style={sharedToolPageStyles.rowBetween}>
              <span>{test.name}</span>
              <span style={test.pass ? sharedToolPageStyles.passText : sharedToolPageStyles.failText}>
                {test.pass ? "PASS" : "FAIL"}
              </span>
            </div>
            {test.details ? <div style={sharedToolPageStyles.testDetails}>{test.details}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
