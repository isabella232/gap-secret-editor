import { isNil } from 'lodash';
import { createPatch } from 'diff';
import * as Diff2Html from 'diff2html';

export default {
  name: 'difference',
  template: require('./difference.html'),
  props: {
    label: String,
    originalValue: String,
    currentValue: String
  },
  computed: {
    content() {
      const changeType = !isNil(this.originalValue) && !isNil(this.currentValue)
        ? 'CHANGED'
        : isNil(this.originalValue)
          ? 'ADDED'
          : 'REMOVED';

      const patch = createPatch(this.label, this.originalValue || '', this.currentValue || '');
      const diffJson = Diff2Html.parse(patch);
      return Diff2Html.html(diffJson, {
        drawFileList: false,
        matching: 'lines',
        outputFormat: 'side-by-side',
        rawTemplates: {
          'generic-file-path':
            `<span>${this.label}</span><span class="e-padding-left-l text-color-gray-400">${changeType}</span>`,
          'generic-empty-diff':
            `<tr>
              <td class="{{CSSLineClass.INFO}}">
                <div class="{{contentClass}} {{CSSLineClass.INFO}}">
                  Value is empty
                </div>
              </td>
            </tr>`
        }
      });
    }
  },
  methods: {
    enableSynchronizedScrolling() {
      const [originalSide, currentSide] = this.$el.querySelectorAll('.d2h-file-side-diff');
      originalSide.addEventListener('scroll', () => currentSide.scrollLeft = originalSide.scrollLeft);
      currentSide.addEventListener('scroll', () => originalSide.scrollLeft = currentSide.scrollLeft);
    }
  },
  mounted() {
    this.enableSynchronizedScrolling();
  },
  updated() {
    this.enableSynchronizedScrolling();
  }
};
