export default {
  name: 'secret-editor',
  template: require('./secret-editor.html'),
  props: {
    value: { type: Array, required: true, default: () => [] }
  },
  computed: {
    displayedSecrets() {
      return this.value.concat({ key: '', value: '' });
    },
    isLastSecret() {
      return (index) => index === this.displayedSecrets.length - 1;
    }
  },
  methods: {
    changeSecretValue(index, event) {
      this.resizeTextArea(event.target);
      this.updateSecrets(index, { value: event.target.value });
    },
    resizeTextArea(element) {
      element.style.height = 'auto';
      element.style.height = `${element.scrollHeight}px`;
    },
    updateSecrets(index, delta) {
      const updatedSecrets = [...this.displayedSecrets];
      Object.assign(updatedSecrets[index], delta);
      this._emitSecretChange(updatedSecrets);
    },
    deleteSecret(index) {
      const updatedSecrets = [...this.displayedSecrets];
      updatedSecrets.splice(index, 1);
      this._emitSecretChange(updatedSecrets);
    },
    _emitSecretChange(secrets) {
      const nonEmptySecrets = secrets.filter(secret => secret.key || secret.value);
      this.$emit('input', nonEmptySecrets);
    }
  }
};
