import { useDialogueFlow, type UseDialogueFlowProps } from './useDialogueFlow';

export type UseDialogueManagementProps = UseDialogueFlowProps;

export const useDialogueManagement = (props: UseDialogueManagementProps) => {
  return useDialogueFlow(props);
};
