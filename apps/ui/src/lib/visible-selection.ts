/**
 * What a reader can actually see of one option, with the visually hidden control taken out.
 *
 * A control that hides its `<input>` and styles a label around it moves the whole burden of saying
 * "this one" onto that label. Comparing the rendered markup of two selections would otherwise pass
 * on the hidden input alone — `checked` changes there whether or not anything visible does — so the
 * `sr-only` subtree is removed before the comparison. What is left is exactly what a sighted reader
 * has to go on.
 *
 * Used by the gate in `visible-selection.test.ts`, which requires every hidden selection control to
 * have a test that calls this.
 */
export const visibleOptionMarkup = (
  container: HTMLElement,
  label: string,
): string => {
  const option = [...container.querySelectorAll('label')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!option)
    throw new Error(
      `no option labelled ${JSON.stringify(label)} was rendered — the gate cannot compare what it cannot find`,
    );

  const visible = option.cloneNode(true) as HTMLElement;
  for (const hidden of visible.querySelectorAll('.sr-only')) hidden.remove();
  return [visible.className, visible.innerHTML].join(' :: ');
};
