// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import expect = require('expect.js');

import {
  nbformat
} from '@jupyterlab/coreutils';

import {
  stripSource
} from '../../../src/diff/util';

import {
  IMergeDecision, MergeDecision
} from '../../../src/merge/decisions';

import {
  opAddRange, opRemoveRange, opPatch, opReplace,
  IDiffEntry
} from '../../../src/diff/diffentries';

import {
    CellMergeModel, NotebookMergeModel
} from '../../../src/merge/model';


const notebook = require('../../files/base.ipynb.json') as nbformat.INotebookContent;
const decisionsNB = require('../../files/decisionsA.json') as IMergeDecision[];


describe('merge', () => {

  describe('model', () => {

    describe('CellMergeModel', () => {

      let codeCellBase: nbformat.ICodeCell = {
        cell_type: 'code',
        execution_count: null!,
        metadata: {
          collapsed: false,
          trusted: false
        },
        outputs: [
          {
            output_type: 'stream',
            name: 'stdout',
            text: '5.0\n'
          }
        ],
        source:
          'l = f(3, 4)\nprint(l)'
      };

      /*
      For reference:
      let codeCellL: nbformat.ICodeCell = {
        cell_type: 'code',
        execution_count: 2,
        metadata: {
          collapsed: false,
          trusted: false
        },
        outputs: [
        ],
        source:
          'l = f(3, 4)\nl += 2\nprint(l)\n'
      };

      let codeCellR: nbformat.ICodeCell = {
        cell_type: 'code',
        execution_count: 4,
        metadata: {
          collapsed: true,
          trusted: false
        },
        outputs: [
          {
            output_type: 'stream',
            name: 'stdout',
            text: '5.0\n'
          }
        ],
        source:
          'l = f(3, 4)\nprint(l)\n'
      };
      */

      let mimetype = 'text/python';

      let ccDecs: IMergeDecision[] = [
        /* Currently not handled!
        {
          local_diff: [
            opReplace('execution_count', 2)
          ],
          remote_diff: [
            opReplace('execution_count', 4)
          ],
          conflict: false,
          action: 'clear',
          common_path: ['cells', 0]
        },*/

        {
          local_diff: [opRemoveRange(0, 1)],
          remote_diff: [],
          action: 'local',
          common_path: ['cells', 0, 'outputs']
        },

        {
          remote_diff: [opReplace('collapsed', true)],
          action: 'remote',
          common_path: ['cells', 0, 'metadata']
        },

        {
          local_diff: [
            opAddRange(1, ['l += 2\n']),
            opPatch(1, [opAddRange('print(l)'.length, ['\n'])]),
          ],
          remote_diff: [
            opPatch(1, [opAddRange('print(l)'.length, ['\n'])]),
          ],
          conflict: true,
          common_path: ['cells', 0, 'source']
        }
      ];

      let decPatchLvsDelR: IMergeDecision = {
        local_diff: [opPatch(0, [
          //opReplace('execution_count', 2),
          opPatch('outputs', [opRemoveRange(0, 1)]),
          opPatch('source', [
            opAddRange(1, ['l += 2\n']),
            opPatch(1, [opAddRange('print(l)'.length, '\n')])
          ])
        ])],
        remote_diff: [opRemoveRange(0, 1)],
        action: 'base',
        conflict: true,
        common_path: ['cells']
      };

      it('should be creatable by base and empty decision set', () => {
        let value = new CellMergeModel(codeCellBase, [], mimetype);
        expect(value.base).to.be(codeCellBase);
        expect(value.decisions).to.be.empty();
        expect(value.mimetype).to.be(mimetype);
      });

      describe('cell level decision', () => {
        let decs: MergeDecision[] = [new MergeDecision(decPatchLvsDelR)];
        let model = new CellMergeModel(codeCellBase, decs, mimetype);

        it('should be creatable by base and decision set', () => {
          expect(model.base).to.be(codeCellBase);
          expect(model.mimetype).to.be(mimetype);
        });

        it('should have remote model marked as deleted', () => {
          expect(model.remote!.deleted).to.be(true);
          expect(model.remote!.added).to.be(false);
          expect(model.remote!.unchanged).to.be(false);
        });

        it('should not be marked as agreeing', () => {
          expect(model.agreedCell).to.be(false);
        });

        it('should split sub-cell level decisions', () => {
          expect(model.decisions.length).to.be(2);
          for (let subdec of model.decisions) {
            expect(subdec.conflict).to.be(true);
            expect(subdec.action).to.be('local');
            expect(subdec.remoteDiff).to.be(null);
          }
          let subdec = model.decisions[0];
          expect(subdec.absolutePath).to.eql(['cells', 0, 'outputs']);
          let expected: IDiffEntry[] = [opRemoveRange(0, 1)];
          expect(stripSource(subdec.localDiff)).to.eql(expected);

          subdec = model.decisions[1];
          expect(subdec.absolutePath).to.eql(['cells', 0, 'source']);
          expected = [
            opAddRange(1, ['l += 2\n']),
            opPatch(1, [opAddRange('print(l)'.length, '\n')])
          ];
          let value = stripSource(subdec.localDiff)!;
          expect(value.length).to.be(expected.length);
          for (let i=0; i < value.length; ++i) {
            expect(value[i]).to.eql(expected[i]);
          }
        });

      });

      describe('sub-cell level decision', () => {
        let decs: MergeDecision[] = [];
        for (let idec of ccDecs) {
          decs.push(new MergeDecision(idec));
        }
        let model = new CellMergeModel(codeCellBase, decs, mimetype);

        it('should be creatable by base and decision set', () => {
          expect(model.base).to.be(codeCellBase);
          expect(model.decisions).to.eql(decs);
          expect(model.mimetype).to.be(mimetype);
        });

        it('should not agree on any field', () => {
          expect(model.agreedSource).to.be(false);
          expect(model.agreedMetadata).to.be(false);
          expect(model.agreedOutputs).to.be(false);
          expect(model.agreedCell).to.be(false);
        });

      });

    });

    describe('NotebookMergeModel', () => {

      it('should initialize a model with empty decisions', () => {
        let model = new NotebookMergeModel(notebook, []);
        expect(model.base).to.be(notebook);
        expect(model.decisions).to.be.empty();
      });

      it('should initialize a model with decisions', () => {
        let model = new NotebookMergeModel(notebook, decisionsNB);
        expect(model.base).to.be(notebook);
      });

      describe('decision splitting', () => {
        const diff: IDiffEntry[] = [
          opPatch(0, [opPatch('metadata', [opReplace('collapsed', true)])]),
          opPatch(2, [opPatch('source', [opAddRange(1, ['    z += 2\n'])])]),
        ];

        const cell1: nbformat.ICell = {
          cell_type: 'markdown',
          source: 'This is cell 1\n',
          metadata: {},
        };
        const cell2: nbformat.ICell = {
          cell_type: 'markdown',
          source: 'This is cell 2\n',
          metadata: {},
        };
        const cell3: nbformat.ICell = {
          cell_type: 'markdown',
          source: 'This is cell 3\n',
          metadata: {},
        };

        it('should split a local patch of cells', () => {
          let cdecs: MergeDecision[] = [new MergeDecision(
            ['cells'], diff, null, 'local'
          )];
          let model = new NotebookMergeModel(notebook, cdecs);

          expect(model.decisions.length).to.be(2);

          let d = model.decisions[0];
          expect(d.action).to.be('local');
          expect(d.absolutePath).to.eql(['cells', 0, 'metadata']);
          expect(stripSource(d.localDiff)).to.eql([opReplace('collapsed', true)]);

          d = model.decisions[1];
          expect(d.action).to.be('local');
          expect(d.absolutePath).to.eql(['cells', 2, 'source']);
          expect(stripSource(d.localDiff)).to.eql([opAddRange(1, ['    z += 2\n'])]);
        });

        it('should split a remote patch of cells', () => {
          let cdecs: MergeDecision[] = [new MergeDecision(
            ['cells'], null, diff, 'remote'
          )];
          let model = new NotebookMergeModel(notebook, cdecs);

          expect(model.decisions.length).to.be(2);

          let d = model.decisions[0];
          expect(d.action).to.be('remote');
          expect(d.absolutePath).to.eql(['cells', 0, 'metadata']);
          expect(stripSource(d.remoteDiff)).to.eql([opReplace('collapsed', true)]);

          d = model.decisions[1];
          expect(d.action).to.be('remote');
          expect(d.absolutePath).to.eql(['cells', 2, 'source']);
          expect(stripSource(d.remoteDiff)).to.eql([opAddRange(1, ['    z += 2\n'])]);
        });

        it('should split an agreed patch of cells', () => {
          let cdecs: MergeDecision[] = [new MergeDecision(
            ['cells'], diff, diff, 'either'
          )];
          let model = new NotebookMergeModel(notebook, cdecs);

          expect(model.decisions.length).to.be(2);

          let d = model.decisions[0];
          expect(d.action).to.be('either');
          expect(d.absolutePath).to.eql(['cells', 0, 'metadata']);
          expect(stripSource(d.localDiff)).to.eql([opReplace('collapsed', true)]);
          expect(stripSource(d.remoteDiff)).to.eql([opReplace('collapsed', true)]);

          d = model.decisions[1];
          expect(d.action).to.be('either');
          expect(d.absolutePath).to.eql(['cells', 2, 'source']);
          expect(stripSource(d.localDiff)).to.eql([opAddRange(1, ['    z += 2\n'])]);
          expect(stripSource(d.remoteDiff)).to.eql([opAddRange(1, ['    z += 2\n'])]);
        });

        it('should split an AR/A cell chunk', () => {
          let cdecs: MergeDecision[] = [new MergeDecision(
            ['cells'],
            [opAddRange(0, [cell1]), opRemoveRange(0, 2)],
            [opAddRange(0, [cell2])],
            'base',
            true
          )];
          let model = new NotebookMergeModel(notebook, cdecs);

          expect(model.decisions.length).to.be(4);

          let d = model.decisions[0];
          expect(d.action).to.be('local');
          expect(d.conflict).to.be(true);
          expect(stripSource(d.localDiff)).to.eql([opAddRange(0, [cell1])]);
          expect(d.remoteDiff).to.be(null);

          d = model.decisions[1];
          expect(d.action).to.be('remote');
          expect(d.conflict).to.be(true);
          expect(d.localDiff).to.be(null);
          expect(stripSource(d.remoteDiff)).to.eql([opAddRange(0, [cell2])]);

          d = model.decisions[2];
          expect(d.action).to.be('local');
          expect(d.conflict).to.be(true);
          expect(stripSource(d.localDiff)).to.eql([opRemoveRange(0, 1)]);
          expect(d.remoteDiff).to.be(null);

          d = model.decisions[3];
          expect(d.action).to.be('local');
          expect(d.conflict).to.be(true);
          expect(stripSource(d.localDiff)).to.eql([opRemoveRange(1, 1)]);
          expect(d.remoteDiff).to.be(null);
        });

        it('should split an A/AR cell chunk', () => {
          let cdecs: MergeDecision[] = [new MergeDecision(
            ['cells'],
            [opAddRange(0, [cell1])],
            [opAddRange(0, [cell2]), opRemoveRange(0, 2)],
            'base',
            true
          )];
          let model = new NotebookMergeModel(notebook, cdecs);

          expect(model.decisions.length).to.be(4);

          let d = model.decisions[0];
          expect(d.action).to.be('local');
          expect(d.conflict).to.be(true);
          expect(stripSource(d.localDiff)).to.eql([opAddRange(0, [cell1])]);
          expect(d.remoteDiff).to.be(null);

          d = model.decisions[1];
          expect(d.action).to.be('remote');
          expect(d.conflict).to.be(true);
          expect(d.localDiff).to.be(null);
          expect(stripSource(d.remoteDiff)).to.eql([opAddRange(0, [cell2])]);

          d = model.decisions[2];
          expect(d.action).to.be('remote');
          expect(d.conflict).to.be(true);
          expect(d.localDiff).to.be(null);
          expect(stripSource(d.remoteDiff)).to.eql([opRemoveRange(0, 1)]);

          d = model.decisions[3];
          expect(d.action).to.be('remote');
          expect(d.conflict).to.be(true);
          expect(d.localDiff).to.be(null);
          expect(stripSource(d.remoteDiff)).to.eql([opRemoveRange(1, 1)]);
        });

        it('should split an AR/AR cell chunk', () => {
          let cdecs: MergeDecision[] = [new MergeDecision(
            ['cells'],
            [opAddRange(0, [cell1]), opRemoveRange(0, 2)],
            [opAddRange(0, [cell2]), opRemoveRange(0, 2)],
            'base',
            true
          )];
          let model = new NotebookMergeModel(notebook, cdecs);

          expect(model.decisions.length).to.be(4);

          let d = model.decisions[0];
          expect(d.action).to.be('local');
          expect(d.conflict).to.be(true);
          expect(stripSource(d.localDiff)).to.eql([opAddRange(0, [cell1])]);
          expect(d.remoteDiff).to.be(null);

          d = model.decisions[1];
          expect(d.action).to.be('remote');
          expect(d.conflict).to.be(true);
          expect(d.localDiff).to.be(null);
          expect(stripSource(d.remoteDiff)).to.eql([opAddRange(0, [cell2])]);

          d = model.decisions[2];
          expect(d.action).to.be('either');
          expect(d.conflict).to.be(false);
          expect(stripSource(d.localDiff)).to.eql([opRemoveRange(0, 1)]);
          expect(stripSource(d.remoteDiff)).to.eql([opRemoveRange(0, 1)]);

          d = model.decisions[3];
          expect(d.action).to.be('either');
          expect(d.conflict).to.be(false);
          expect(stripSource(d.localDiff)).to.eql([opRemoveRange(1, 1)]);
          expect(stripSource(d.remoteDiff)).to.eql([opRemoveRange(1, 1)]);
        });

        it('should split an AP/A cell chunk', () => {
          const lineAdd = opPatch('source', [opAddRange(1, 'line #2\n')]);
          let cdecs: MergeDecision[] = [new MergeDecision(
            ['cells'],
            [opAddRange(0, [cell1]), opPatch(0, [lineAdd])],
            [opAddRange(0, [cell2])],
            'base',
            true
          )];
          let model = new NotebookMergeModel(notebook, cdecs);

          expect(model.decisions.length).to.be(3);

          let d = model.decisions[0];
          expect(d.action).to.be('local');
          expect(d.conflict).to.be(true);
          expect(stripSource(d.localDiff)).to.eql([opAddRange(0, [cell1])]);
          expect(d.remoteDiff).to.be(null);

          d = model.decisions[1];
          expect(d.action).to.be('remote');
          expect(d.conflict).to.be(true);
          expect(d.localDiff).to.be(null);
          expect(stripSource(d.remoteDiff)).to.eql([opAddRange(0, [cell2])]);

          d = model.decisions[2];
          expect(d.action).to.be('local');
          expect(d.conflict).to.be(true);
          expect(d.absolutePath).to.eql(['cells', 0, 'source']);
          expect(stripSource(d.localDiff)).to.eql([opAddRange(1, 'line #2\n')]);
          expect(d.remoteDiff).to.be(null);
        });

        it('should split an A/AP cell chunk', () => {
          const lineAdd = opPatch('source', [opAddRange(1, 'line #2\n')]);
          let cdecs: MergeDecision[] = [new MergeDecision(
            ['cells'],
            [opAddRange(0, [cell1])],
            [opAddRange(0, [cell2]), opPatch(0, [lineAdd])],
            'base',
            true
          )];
          let model = new NotebookMergeModel(notebook, cdecs);

          expect(model.decisions.length).to.be(3);

          let d = model.decisions[0];
          expect(d.action).to.be('local');
          expect(d.conflict).to.be(true);
          expect(stripSource(d.localDiff)).to.eql([opAddRange(0, [cell1])]);
          expect(d.remoteDiff).to.be(null);

          d = model.decisions[1];
          expect(d.action).to.be('remote');
          expect(d.conflict).to.be(true);
          expect(d.localDiff).to.be(null);
          expect(stripSource(d.remoteDiff)).to.eql([opAddRange(0, [cell2])]);

          d = model.decisions[2];
          expect(d.action).to.be('remote');
          expect(d.conflict).to.be(true);
          expect(d.absolutePath).to.eql(['cells', 0, 'source']);
          expect(d.localDiff).to.be(null);
          expect(stripSource(d.remoteDiff)).to.eql([opAddRange(1, 'line #2\n')]);
        });

        it('should split an AP/AP cell chunk', () => {
          const lineAdd = opPatch('source', [opAddRange(1, 'line #2\n')]);
          let cdecs: MergeDecision[] = [new MergeDecision(
            ['cells'],
            [opAddRange(0, [cell1]), opPatch(0, [lineAdd])],
            [opAddRange(0, [cell2]), opPatch(0, [lineAdd])],
            'base',
            true
          )];
          let model = new NotebookMergeModel(notebook, cdecs);

          expect(model.decisions.length).to.be(3);

          let d = model.decisions[0];
          expect(d.action).to.be('local');
          expect(d.conflict).to.be(true);
          expect(stripSource(d.localDiff)).to.eql([opAddRange(0, [cell1])]);
          expect(d.remoteDiff).to.be(null);

          d = model.decisions[1];
          expect(d.action).to.be('remote');
          expect(d.conflict).to.be(true);
          expect(d.localDiff).to.be(null);
          expect(stripSource(d.remoteDiff)).to.eql([opAddRange(0, [cell2])]);

          d = model.decisions[2];
          expect(d.action).to.be('either');
          expect(d.conflict).to.be(false);
          expect(d.absolutePath).to.eql(['cells', 0, 'source']);
          expect(stripSource(d.localDiff)).to.eql([opAddRange(1, 'line #2\n')]);
          expect(stripSource(d.remoteDiff)).to.eql([opAddRange(1, 'line #2\n')]);
        });

        it('should split an ADDRANGE/REMOVERANGE conflict', () => {
          const lineAdd = opPatch('source', [opAddRange(1, 'line #2\n')]);
          let cdecs: MergeDecision[] = [new MergeDecision(
            ['cells'],
            [opAddRange(0, [cell1])],
            [opRemoveRange(0, 1)],
            'local_then_remote',
            true
          )];
          let model = new NotebookMergeModel(notebook, cdecs);

          expect(model.decisions.length).to.be(2);
          let d = model.decisions[0];
          expect(d.action).to.be('local');
          expect(d.conflict).to.be(true);
          expect(stripSource(d.localDiff)).to.eql([opAddRange(0, [cell1])]);
          expect(d.remoteDiff).to.be(null);

          d = model.decisions[1];
          expect(d.action).to.be('remote');
          expect(d.conflict).to.be(true);
          expect(d.localDiff).to.be(null);
          expect(stripSource(d.remoteDiff)).to.eql([opRemoveRange(0, 1)]);

        });

        it('should split an REMOVERANGE/ADDRANGE conflict', () => {
          const lineAdd = opPatch('source', [opAddRange(1, 'line #2\n')]);
          let cdecs: MergeDecision[] = [new MergeDecision(
            ['cells'],
            [opRemoveRange(0, 1)],
            [opAddRange(0, [cell1])],
            'local_then_remote',
            true
          )];
          let model = new NotebookMergeModel(notebook, cdecs);

          expect(model.decisions.length).to.be(2);
          let d = model.decisions[0];
          expect(d.action).to.be('remote');
          expect(d.conflict).to.be(true);
          expect(d.localDiff).to.be(null);
          expect(stripSource(d.remoteDiff)).to.eql([opAddRange(0, [cell1])]);

          d = model.decisions[1];
          expect(d.action).to.be('local');
          expect(d.conflict).to.be(true);
          expect(stripSource(d.localDiff)).to.eql([opRemoveRange(0, 1)]);
          expect(d.remoteDiff).to.be(null);

        });

      });

    });

  });

});
