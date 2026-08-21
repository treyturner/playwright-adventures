export interface TextPattern {
  pattern: string;
  ignoreCase: boolean;
}

interface SelectorBase {
  first: boolean;
}

export interface RoleSelector extends SelectorBase {
  by: 'role';
  role: 'button' | 'heading' | 'link';
  name: TextPattern | null;
  level: number | null;
}

export interface LabelSelector extends SelectorBase {
  by: 'label';
  name: TextPattern;
}

export interface TestIdSelector extends SelectorBase {
  by: 'testId';
  value: string;
}

export type SelectorSpec = RoleSelector | LabelSelector | TestIdSelector;
export type FixtureValue = 'user.email' | 'user.password' | 'user.displayName';

export interface NavigateStep {
  action: 'navigate';
  path: string;
}

export interface ClickStep {
  action: 'click';
  selector: SelectorSpec;
}

export interface FillStep {
  action: 'fill';
  selector: SelectorSpec;
  value: FixtureValue;
}

export interface AssertVisibleStep {
  action: 'assert-visible';
  selector: SelectorSpec;
}

export type JourneyStep = NavigateStep | ClickStep | FillStep | AssertVisibleStep;

export interface JourneySpec {
  id: string;
  name: string;
  description: string;
  successMessage: string;
  extends: string | null;
  preconditions: readonly string[];
  steps: readonly JourneyStep[];
}
