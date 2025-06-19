import { usePlayerActions, UsePlayerActionsProps } from './usePlayerActions';
import { useMapUpdates } from './useMapUpdates';

export type UseGameTurnProps = UsePlayerActionsProps;

export const useGameTurn = (props: UseGameTurnProps) => {
  const { setGameStateStack } = props;

  const mapUpdateFns = useMapUpdates({ setGameStateStack });
  const playerActionFns = usePlayerActions(props);

  return {
    ...playerActionFns,
    ...mapUpdateFns,
  };
};
