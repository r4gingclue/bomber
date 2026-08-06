import { describe, expect, it } from 'vitest';
import { moveUpgradeFocus } from './upgrade-navigation';

describe('moveUpgradeFocus', () => {
  const nodeCounts = [6, 6, 5, 5];

  it('moves left and right between branches while retaining a valid node', () => {
    expect(moveUpgradeFocus({ branch: 0, node: 0, nodeCounts }, 'right')).toEqual({ branch: 1, node: 0 });
    expect(moveUpgradeFocus({ branch: 2, node: 4, nodeCounts }, 'left')).toEqual({ branch: 1, node: 4 });
    expect(moveUpgradeFocus({ branch: 1, node: 5, nodeCounts }, 'right')).toEqual({ branch: 2, node: 4 });
  });

  it('moves up and down within the selected branch without leaving its bounds', () => {
    expect(moveUpgradeFocus({ branch: 3, node: 2, nodeCounts }, 'up')).toEqual({ branch: 3, node: 1 });
    expect(moveUpgradeFocus({ branch: 3, node: 4, nodeCounts }, 'down')).toEqual({ branch: 3, node: 4 });
    expect(moveUpgradeFocus({ branch: 0, node: 0, nodeCounts }, 'up')).toEqual({ branch: 0, node: 0 });
  });
});
