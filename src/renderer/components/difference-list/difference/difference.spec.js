import { mount } from '@vue/test-utils';
import Difference from './difference';

describe('Difference', () => {
  describe('#changeType', () => {
    it('should return CHANGED when both original and current values are given but they differ', () => {
      const { vm } = mount(Difference, { propsData: { originalValue: 'pizza', currentValue: 'burger' } });
      expect(vm.changeType).to.eql('CHANGED');
    });

    it('should return REMOVED when only original value is given', () => {
      const { vm } = mount(Difference, { propsData: { originalValue: 'pizza', currentValue: null } });
      expect(vm.changeType).to.eql('REMOVED');
    });

    it('should return ADDED when only current value is given', () => {
      const { vm } = mount(Difference, { propsData: { originalValue: null, currentValue: 'burger' } });
      expect(vm.changeType).to.eql('ADDED');
    });
  });

  describe('#invalidatedJsonMessage', () => {
    it('should return some message when a valid json changed to invalid', () => {
      const { vm } = mount(Difference, { propsData: { originalValue: '{"key":"value"}', currentValue: '{"key"}' } });
      expect(vm.invalidatedJsonMessage).to.include('JSON');
    });

    it('should return empty string when a valid json remained valid', () => {
      const { vm } = mount(Difference, { propsData: { originalValue: '{"key":"value"}', currentValue: '{"k":"v"}' } });
      expect(vm.invalidatedJsonMessage).to.eql('');
    });

    it('should return empty string when an invalid json remained invalid', () => {
      const { vm } = mount(Difference, { propsData: { originalValue: '{"key"}', currentValue: '{"value"}' } });
      expect(vm.invalidatedJsonMessage).to.eql('');
    });
  });
});
