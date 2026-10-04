import { IconBraces, IconCheck, IconRefresh } from "@tabler/icons-react";
import { useState, type WheelEvent } from "react";
import { FloatingToolWindow } from "../../ui/patterns/overlays";
import { Button } from "../../ui/primitives/Button";
import { TextArea } from "../../ui/primitives/FormControls";
import "./ContainerJsonEditorWindow.css";

type ContainerJsonEditorWindowProps = {
  containerName: string;
  initialJson: string;
  onApply: (json: string) => void;
  onClose: () => void;
};

const MIN_FONT_SIZE = 9;
const MAX_FONT_SIZE = 24;

/** The Copy/Paste JSON editor: a floating window; a successful Apply is closed by its owner. */
export function ContainerJsonEditorWindow({
  containerName,
  initialJson,
  onApply,
  onClose,
}: ContainerJsonEditorWindowProps) {
  const [draft, setDraft] = useState(initialJson);
  const [fontSize, setFontSize] = useState(12);

  const handleEditorWheel = (event: WheelEvent<HTMLTextAreaElement>) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    event.stopPropagation();
    setFontSize((current) =>
      Math.max(MIN_FONT_SIZE, Math.min(current + (event.deltaY < 0 ? 1 : -1), MAX_FONT_SIZE)),
    );
  };

  return (
    <FloatingToolWindow
      label={`Edit JSON for ${containerName}`}
      icon={<IconBraces size={19} stroke={2} />}
      title={`Copy/Paste JSON - ${containerName}`}
      closeLabel="Close JSON editor"
      onClose={onClose}
      initialSize={{ width: 620, height: 480 }}
      minimumSize={{ width: 380, height: 280 }}
      actions={
        <>
          <Button
            variant="ghost"
            size="compact"
            leadingIcon={<IconRefresh size={16} stroke={2} />}
            onClick={() => setDraft(initialJson)}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            size="compact"
            leadingIcon={<IconCheck size={16} stroke={2} />}
            onClick={() => onApply(draft)}
          >
            Apply JSON
          </Button>
        </>
      }
    >
      <TextArea
        className="taskmap-json-editor__text taskmap-scrollbar-thin"
        style={{ fontSize, lineHeight: `${Math.round(fontSize * 1.65)}px` }}
        value={draft}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onWheel={handleEditorWheel}
        aria-label="Container JSON"
      />
    </FloatingToolWindow>
  );
}
