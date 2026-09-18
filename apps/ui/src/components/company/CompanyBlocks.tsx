import type { CompanyBlock } from '../../content/company';

import { RichText } from './RichText';

type CompanyBlocksProps = {
  blocks: readonly CompanyBlock[];
};

const blockKey = (block: CompanyBlock, index: number) => {
  if (block.kind === 'table') return `${index}-table-${block.columns[0] ?? ''}`;
  if (block.kind === 'list') return `${index}-list-${block.items.length}`;
  return `${index}-${block.kind}-${block.text.slice(0, 32)}`;
};

export const CompanyBlocks = ({ blocks }: CompanyBlocksProps) => (
  <div className="space-y-4">
    {blocks.map((block, index) => {
      const key = blockKey(block, index);

      if (block.kind === 'subheading') {
        return (
          <h3
            key={key}
            className="pt-4 font-display text-body-lg font-semibold text-base-content"
          >
            <RichText value={block.text} />
          </h3>
        );
      }

      if (block.kind === 'note') {
        return (
          <p
            key={key}
            role="note"
            className="rounded-xl border border-base-300 bg-base-200 px-4 py-3 text-body-sm leading-7 text-neutral"
          >
            <RichText value={block.text} />
          </p>
        );
      }

      if (block.kind === 'list') {
        return (
          <ul key={key} className="space-y-2 ps-5">
            {block.items.map((item) => (
              <li
                key={item.slice(0, 40)}
                className="list-disc text-body leading-8 text-neutral marker:text-taupe"
              >
                <RichText value={item} />
              </li>
            ))}
          </ul>
        );
      }

      if (block.kind === 'table') {
        return (
          <div
            key={key}
            className="overflow-x-auto rounded-xl border border-base-300"
          >
            <table className="w-full border-collapse text-body-sm">
              <thead>
                <tr className="bg-base-200">
                  {block.columns.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="border-b border-base-300 px-4 py-3 text-start font-semibold text-base-content"
                    >
                      <RichText value={column} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row) => (
                  <tr key={row.join('|').slice(0, 60)}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${cellIndex}-${cell.slice(0, 24)}`}
                        className="border-b border-base-300 px-4 py-3 align-top leading-7 text-neutral last:border-b-0"
                      >
                        <RichText value={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      return (
        <p key={key} className="text-body leading-8 text-neutral">
          <RichText value={block.text} />
        </p>
      );
    })}
  </div>
);
