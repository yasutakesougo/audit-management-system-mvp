import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, IconButton, Stack, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import Modeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

type CrisisFlowchartPayload = {
  xml?: string;
  redFlags?: Array<{ elementId: string; reason: string }>;
};

interface CrisisFlowchartEditorProps {
  value?: Record<string, unknown>;
  onChange: (payload: Record<string, unknown>) => void;
}

interface BpmnEventBus {
  on(event: string, callback: (event: unknown) => void): void;
  off(event: string, callback: (event: unknown) => void): void;
}

interface BpmnModeling {
  setColor?: (element: unknown, colors: { stroke?: string; fill?: string } | null) => void;
}

interface BpmnElementRegistry {
  get(id: string): unknown;
  getAll(): unknown[];
}

const DEFAULT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  targetNamespace="http://bpmn.io/schema/bpmn"
  exporter="bpmn-js (https://bpmn.io)"
  exporterVersion="16.5.0">
  <bpmn:process id="CrisisResponse" isExecutable="false">
    <bpmn:startEvent id="StartEvent_Initial" name="行動の兆候を察知">
      <bpmn:outgoing>Flow_0</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_Deescalate" name="落ち着かせるための働きかけ">
      <bpmn:incoming>Flow_0</bpmn:incoming>
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:task>
    <bpmn:exclusiveGateway id="Gateway_BehaviorSettled" name="行動は収まったか？">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_Yes</bpmn:outgoing>
      <bpmn:outgoing>Flow_No</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:endEvent id="EndEvent_Settled" name="安全が確保された">
      <bpmn:incoming>Flow_Yes</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:task id="Task_Escalate" name="応援要請・危機対応">
      <bpmn:incoming>Flow_No</bpmn:incoming>
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:task>
    <bpmn:sequenceFlow id="Flow_0" sourceRef="StartEvent_Initial" targetRef="Task_Deescalate" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Task_Deescalate" targetRef="Gateway_BehaviorSettled" />
    <bpmn:sequenceFlow id="Flow_Yes" sourceRef="Gateway_BehaviorSettled" targetRef="EndEvent_Settled" />
    <bpmn:sequenceFlow id="Flow_No" sourceRef="Gateway_BehaviorSettled" targetRef="Task_Escalate" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="CrisisResponse">
      <bpmndi:BPMNShape id="StartEvent_Initial_di" bpmnElement="StartEvent_Initial">
        <dc:Bounds x="152" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Deescalate_di" bpmnElement="Task_Deescalate">
        <dc:Bounds x="240" y="80" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_BehaviorSettled_di" bpmnElement="Gateway_BehaviorSettled" isMarkerVisible="true">
        <dc:Bounds x="420" y="95" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_Settled_di" bpmnElement="EndEvent_Settled">
        <dc:Bounds x="540" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Escalate_di" bpmnElement="Task_Escalate">
        <dc:Bounds x="400" y="200" width="140" height="80" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const parsePayload = (value?: Record<string, unknown>): CrisisFlowchartPayload => {
  if (!value) {
    return {};
  }
  const xml = typeof value.xml === 'string' ? value.xml : undefined;
  const redFlags = Array.isArray(value.redFlags) ? value.redFlags : [];
  return { xml, redFlags };
};

const CrisisFlowchartEditor: React.FC<CrisisFlowchartEditorProps> = ({ value, onChange }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const modelerRef = useRef<Modeler | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [redFlagReason, setRedFlagReason] = useState('');
  const [redFlags, setRedFlags] = useState<Array<{ elementId: string; reason: string }>>([]);
  const redFlagsRef = useRef<Array<{ elementId: string; reason: string }>>([]);
  const onChangeRef = useRef(onChange);
  const initialPayloadRef = useRef(parsePayload(value));

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    redFlagsRef.current = redFlags;
  }, [redFlags]);

  useEffect(() => {
    modelerRef.current = new Modeler({
      container: containerRef.current!,
    });

    const modeler = modelerRef.current;
    const { xml, redFlags: initialFlags } = initialPayloadRef.current;

    const loadDiagram = async () => {
      try {
        await modeler.importXML(xml ?? DEFAULT_XML);
        setRedFlags(initialFlags ?? []);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load BPMN diagram', error);
      }
    };

    loadDiagram();

    const eventBus = modeler.get('eventBus') as BpmnEventBus;
    const modeling = modeler.get('modeling') as BpmnModeling;
    const elementRegistry = modeler.get('elementRegistry') as BpmnElementRegistry;

    const selectionChanged = (event: unknown) => {
      if (!event || typeof event !== 'object') {
        setSelectedElementId(null);
        return;
      }

      const newSelection = (event as { newSelection?: unknown[] }).newSelection;
      const first = Array.isArray(newSelection) ? newSelection[0] : null;
      const rawId = first && typeof first === 'object' && first !== null && 'id' in first
        ? (first as { id?: unknown }).id
        : null;
      setSelectedElementId(typeof rawId === 'string' ? rawId : null);
    };

    eventBus.on('selection.changed', selectionChanged);

    const commandStackChanged = async () => {
      const { xml: updatedXml } = await modeler.saveXML({ format: true });
      onChangeRef.current({
        xml: updatedXml,
        redFlags: redFlagsRef.current,
      });
    };

    eventBus.on('commandStack.changed', commandStackChanged);

    const applyRedFlagStyles = (flags: Array<{ elementId: string; reason: string }>) => {
      if (!modeling?.setColor) return;
      flags.forEach((flag) => {
        const element = elementRegistry.get(flag.elementId);
        if (element) {
          modeling.setColor?.(element, {
            stroke: '#d32f2f',
            fill: '#fdecea',
          });
        }
      });
    };

    applyRedFlagStyles(initialFlags ?? []);

    return () => {
      eventBus.off('selection.changed', selectionChanged);
      eventBus.off('commandStack.changed', commandStackChanged);
      modeler.destroy();
      modelerRef.current = null;
    };
  }, []); // mount only

  const syncRedFlagStyles = (flags: Array<{ elementId: string; reason: string }>) => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    const modeling = modeler.get('modeling') as BpmnModeling;
    const elementRegistry = modeler.get('elementRegistry') as BpmnElementRegistry;
    if (!modeling?.setColor) {
      return;
    }
    elementRegistry.getAll().forEach((element) => {
      modeling.setColor?.(element, null);
    });
    flags.forEach((flag) => {
      const element = elementRegistry.get(flag.elementId);
      if (element) {
        modeling.setColor?.(element, { stroke: '#d32f2f', fill: '#fdecea' });
      }
    });
  };

  useEffect(() => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    const { xml, redFlags: incomingFlags } = parsePayload(value);
    const flags = incomingFlags ?? [];
    if (xml) {
      modeler
        .importXML(xml)
        .then(() => {
          setRedFlags(flags);
          redFlagsRef.current = flags;
          syncRedFlagStyles(flags);
        })
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.error('Failed to sync BPMN XML from props', error);
        });
    } else {
      setRedFlags(flags);
      redFlagsRef.current = flags;
      syncRedFlagStyles(flags);
    }
  }, [value]); 

  const persistState = async (nextRedFlags: Array<{ elementId: string; reason: string }>) => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    try {
      const { xml: updatedXml } = await modeler.saveXML({ format: true });
      onChangeRef.current({
        xml: updatedXml,
        redFlags: nextRedFlags,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Unable to serialise BPMN diagram', error);
    }
  };

  const handleRegisterRedFlag = () => {
    if (!selectedElementId || !redFlagReason.trim()) {
      return;
    }
    const next = [
      ...redFlags.filter((flag) => flag.elementId !== selectedElementId),
      {
        elementId: selectedElementId,
        reason: redFlagReason.trim(),
      },
    ];
    redFlagsRef.current = next;
    setRedFlags(next);
    syncRedFlagStyles(next);
    persistState(next);
    setRedFlagReason('');
  };

  const handleRemoveRedFlag = (elementId: string) => {
    const next = redFlags.filter((flag) => flag.elementId !== elementId);
    redFlagsRef.current = next;
    setRedFlags(next);
    syncRedFlagStyles(next);
    persistState(next);
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box
            ref={containerRef}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              height: 420,
              '& .djs-palette': {
                display: { xs: 'none', md: 'block' },
              },
            }}
          />
          <Stack spacing={1}>
            <Typography variant="subtitle2">禁止事項（Red Flags）の登録</Typography>
            <Alert severity="warning">
              身体拘束や強制的対応など、不適切な手段は必ず禁止事項として登録してください。図中の対象ステップが赤枠で強調されます。
            </Alert>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField
                label="選択中のノードID"
                value={selectedElementId ?? ''}
                InputProps={{ readOnly: true }}
                sx={{ flexBasis: { md: '30%' } }}
              />
              <TextField
                label="禁止理由 / 注意事項"
                value={redFlagReason}
                onChange={(event) => setRedFlagReason(event.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                color="error"
                onClick={handleRegisterRedFlag}
                disabled={!selectedElementId || !redFlagReason.trim()}
              >
                禁止事項として登録
              </Button>
            </Stack>
            <Stack spacing={1}>
              {redFlags.map((flag) => (
                <Alert
                  key={flag.elementId}
                  severity="error"
                  sx={{ alignItems: 'center' }}
                  action={
                    <IconButton
                      aria-label="remove-red-flag"
                      color="inherit"
                      size="small"
                      onClick={() => handleRemoveRedFlag(flag.elementId)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <Typography variant="body2" fontWeight={600}>
                    {flag.elementId}
                  </Typography>
                  <Typography variant="body2">{flag.reason}</Typography>
                </Alert>
              ))}
              {redFlags.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  現在登録されている禁止事項はありません。
                </Typography>
              )}
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default CrisisFlowchartEditor;
