import flushPromises from 'flush-promises';
import { mountWithStore, shallowMountWithStore } from '../../../../test-helpers/mount-helpers';
import kubernetesClient from '../../lib/kubernetes-client/kubernetes-client';
import notificationDisplayer from '../../lib/notification-displayer';

import App, {
  LOCALSTORAGE_KEY_LAST_SELECTED_CONTEXT,
  LOCALSTORAGE_KEY_LAST_SELECTED_NAMESPACE,
  LOCALSTORAGE_KEY_LAST_SELECTED_NAME
} from './app';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('#availableContexts', () => {
    it('should return available contexts in UI Kit select format and with a short name', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([
        'prefix_gap-stage_postfix',
        'prefix_gap-prod_postfix',
        'prefix_custom-team-stage_postfix',
        'prefix_custom-team-prod_postfix'
      ]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      const { vm } = await loadApp();
      vm.context = 'prefix_gap-stage_postfix';

      expect(vm.availableContexts).to.eql([
        { type: 'option', content: 'gap-stage', value: 'prefix_gap-stage_postfix', selected: true },
        { type: 'option', content: 'gap-prod', value: 'prefix_gap-prod_postfix', selected: false },
        { type: 'option', content: 'custom-team-stage', value: 'prefix_custom-team-stage_postfix', selected: false },
        { type: 'option', content: 'custom-team-prod', value: 'prefix_custom-team-prod_postfix', selected: false }
      ]);
    });
  });

  describe('#namespaces', () => {
    it('should return available namespaces in UI Kit select format', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves(['team1', 'team2']);
      const { vm } = await loadApp();
      vm.secretNamespace = 'team2';

      expect(vm.namespaces).to.eql([
        { type: 'option', content: 'team1', value: 'team1', selected: false },
        { type: 'option', content: 'team2', value: 'team2', selected: true }
      ]);
    });
  });

  describe('#namesForSelectedNamespace', () => {
    it('should return available names in UI Kit select format', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      const { vm } = await loadApp();
      vm.secretName = 'secret2';
      vm.nameList = ['secret1', 'secret2'];

      expect(vm.namesForSelectedNamespace).to.eql([
        { type: 'option', content: 'secret1', value: 'secret1', selected: false },
        { type: 'option', content: 'secret2', value: 'secret2', selected: true }
      ]);
    });
  });

  describe('#saveEnabled', () => {
    it('should return false when secret is not loaded', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      const { vm } = await loadApp();

      expect(vm.saveEnabled).to.be.false;
    });

    it('should return false when secret is loaded but not changed', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD1: 'value1', FIELD2: 'value2' });
      const { vm } = await loadApp();
      vm.secretNamespace = 'space';
      vm.secretName = 'name';
      await vm.loadSecret();

      expect(vm.saveEnabled).to.be.false;
    });

    it('should return true when secret is loaded then changed', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD1: 'value1', FIELD2: 'value2' });
      const { vm } = await loadApp();
      vm.secretNamespace = 'space';
      vm.secretName = 'name';
      await vm.loadSecret();
      vm.secret[0].value = 'changed value';

      expect(vm.saveEnabled).to.be.true;
    });

    it('should return false when secret is loaded but then changed to field key duplication', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD1: 'value1', FIELD2: 'value2' });
      const { vm } = await loadApp();
      vm.secretNamespace = 'space';
      vm.secretName = 'name';
      await vm.loadSecret();
      vm.secret[0].key = 'duplicated';
      vm.secret[1].key = 'duplicated';

      expect(vm.saveEnabled).to.be.false;
    });

    it('should return false when secret is being saved', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD1: 'value1', FIELD2: 'value2' });
      const { vm } = await loadApp();
      vm.secretNamespace = 'space';
      vm.secretName = 'name';
      await vm.loadSecret();
      vm.secret[0].value = 'changed value';
      const savePromise = vm.saveSecret();

      expect(vm.saveEnabled).to.be.false;

      await savePromise;
    });
  });

  describe('#selectContext', () => {
    it('should set context field on component', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves(['staging', 'production']);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'listSecrets').resolves([]);
      const { vm } = await loadApp();
      vm.context = 'production';

      await vm.selectContext('staging');

      expect(vm.context).to.eql('staging');
    });

    it('should set kubernetes context', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves(['staging', 'production']);
      sinon.stub(kubernetesClient, 'setContext');
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'listSecrets').resolves([]);
      const { vm } = await loadApp();

      await vm.selectContext('staging');

      expect(kubernetesClient.setContext).to.have.been.calledWith('staging');
    });

    it('should store selection to local storage', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves(['staging', 'production']);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'listSecrets').resolves([]);
      localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_CONTEXT] = 'some old value';
      const { vm } = await loadApp();

      await vm.selectContext('staging');

      expect(localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_CONTEXT]).to.eql('staging');
    });

    it('should reload namespaces', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves(['staging', 'production']);
      sinon.stub(kubernetesClient, 'setContext');
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'listSecrets').resolves([]);
      const { vm } = await loadApp();

      await vm.selectContext('staging');

      expect(kubernetesClient.listNamespaces).to.have.been.calledTwice;
    });

    it('should clear loaded secret', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves(['staging', 'production']);
      sinon.stub(kubernetesClient, 'setContext');
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'listSecrets').resolves([]);
      const { vm } = await loadApp();
      vm.originalSecret = { doesnt: 'matter' };
      vm.secret = [{ key: 'doesnt', value: 'matter' }];
      vm.secretLoaded = true;

      await vm.selectContext('staging');

      expect(vm.secret).to.eql([]);
      expect(vm.secretLoaded).to.be.false;
    });

    it('should not set kubernetes context when user cancels a change', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves(['staging', 'production']);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves(['namespace1', 'namespace2']);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD: 'value' });
      sinon.stub(notificationDisplayer, 'shouldChangesBeDiscarded').resolves(false);
      const { vm } = await loadApp();
      vm.context = 'staging';
      vm.secretNamespace = 'namespace1';
      vm.originalSecret = { FIELD: 'value' };
      vm.secretLoaded = true;

      vm.secret = [{ key: 'FIELD', value: 'new-value' }];

      await vm.selectContext('production');

      expect(vm.context).to.eql('staging');
    });

    it('should set context when user discards unsaved changes', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves(['staging', 'production']);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves(['namespace1', 'namespace2']);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD: 'value' });
      sinon.stub(notificationDisplayer, 'shouldChangesBeDiscarded').resolves(true);
      const { vm } = await loadApp();
      vm.context = 'staging';
      vm.secretNamespace = 'namespace1';
      vm.originalSecret = { FIELD: 'value' };
      vm.secretLoaded = true;

      vm.secret = [{ key: 'FIELD', value: 'new-value' }];

      await vm.selectContext('production');

      expect(vm.context).to.eql('production');
    });

    it('should not ask for user confirmation when there are no changes in the secret', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves(['staging', 'production']);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves(['namespace1', 'namespace2']);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD: 'value' });
      sinon.stub(notificationDisplayer, 'shouldChangesBeDiscarded');
      const { vm } = await loadApp();
      vm.context = 'staging';
      vm.secretNamespace = 'namespace1';
      vm.originalSecret = { FIELD: 'value' };
      vm.secretLoaded = true;

      vm.secret = [{ key: 'FIELD', value: 'value' }];

      await vm.selectContext('production');

      expect(notificationDisplayer.shouldChangesBeDiscarded).to.not.have.been.called;
    });
  });

  describe('#selectNamespace', () => {
    it('should set namespace field on component', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves(['team1', 'team2']);
      sinon.stub(kubernetesClient, 'listSecrets').resolves([]);
      const { vm } = await loadApp();
      vm.secretNamespace = 'whatever';

      await vm.selectNamespace('team1');

      expect(vm.secretNamespace).to.eql('team1');
    });

    it('should store selection to local storage when secret list loading succeeds', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves(['team1', 'team2']);
      sinon.stub(kubernetesClient, 'listSecrets').resolves([]);
      localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_NAMESPACE] = 'some old value';
      const { vm } = await loadApp();

      await vm.selectNamespace('team1');

      expect(localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_NAMESPACE]).to.eql('team1');
    });

    it('should not store selection to local storage when secret list loading fails', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves(['team1', 'team2']);
      sinon.stub(kubernetesClient, 'listSecrets').rejects(new Error('baj van'));
      localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_NAMESPACE] = 'some old value';
      const { vm } = await loadApp();

      await vm.selectNamespace('team1');

      expect(localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_NAMESPACE]).to.eql('some old value');
    });

    it('should clear loaded secret', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'listSecrets').resolves([]);
      const { vm } = await loadApp();
      vm.originalSecret = { doesnt: 'matter' };
      vm.secret = [{ key: 'doesnt', value: 'matter' }];
      vm.secretLoaded = true;

      await vm.selectNamespace('team1');

      expect(vm.secret).to.eql([]);
      expect(vm.secretLoaded).to.be.false;
    });

    it('should not set namespace when user cancels a change', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves(['team1', 'team2']);
      sinon.stub(kubernetesClient, 'listSecrets').resolves([]);
      sinon.stub(notificationDisplayer, 'shouldChangesBeDiscarded').resolves(false);
      const { vm } = await loadApp();
      vm.secretNamespace = 'team1';
      vm.originalSecret = { FIELD: 'value' };
      vm.secret = [{ key: 'FIELD', value: 'new-value' }];

      await vm.selectNamespace('team2');

      expect(vm.secretNamespace).to.eql('team1');
    });

    it('should set namespace when user discards unsaved changes', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves(['team1', 'team2']);
      sinon.stub(kubernetesClient, 'listSecrets').resolves([]);
      sinon.stub(notificationDisplayer, 'shouldChangesBeDiscarded').resolves(true);
      const { vm } = await loadApp();
      vm.secretNamespace = 'team1';
      vm.originalSecret = { FIELD: 'value' };
      vm.secret = [{ key: 'FIELD', value: 'new-value' }];

      await vm.selectNamespace('team2');

      expect(vm.secretNamespace).to.eql('team2');
    });

    it('should not ask for user confirmation when there are no changes in the secret', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves(['team1', 'team2']);
      sinon.stub(kubernetesClient, 'listSecrets').resolves([]);
      sinon.stub(notificationDisplayer, 'shouldChangesBeDiscarded');
      const { vm } = await loadApp();
      vm.secretNamespace = 'team1';
      vm.originalSecret = { FIELD: 'value' };
      vm.secret = [{ key: 'FIELD', value: 'value' }];

      await vm.selectNamespace('team2');

      expect(notificationDisplayer.shouldChangesBeDiscarded).to.not.have.been.called;
    });
  });

  describe('#selectName', () => {
    it('should set name field on component', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      const { vm } = await loadApp();
      vm.secretName = 'whatever';

      await vm.selectName('cool-app');

      expect(vm.secretName).to.eql('cool-app');
    });

    it('should load selected secret', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD1: 'value1', FIELD2: 'value2' });
      const { vm } = await loadApp();
      vm.secretNamespace = 'some-namespace';

      await vm.selectName('cool-app');

      expect(vm.secret).to.eql([{ key: 'FIELD1', value: 'value1' }, { key: 'FIELD2', value: 'value2' }]);
    });

    it('should store selection to local storage', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_NAME] = 'some old value';
      const { vm } = await loadApp();

      await vm.selectName('cool-app');

      expect(localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_NAME]).to.eql('cool-app');
    });

    it('should clear secret then load selected one', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      const loadPromise = resolvablePromise();
      sinon.stub(kubernetesClient, 'loadSecret').returns(loadPromise);
      const { vm } = await loadApp();
      vm.secretNamespace = 'some-nice-namespace';
      vm.originalSecret = { doesnt: 'matter' };
      vm.secret = [{ key: 'doesnt', value: 'matter' }];
      vm.secretLoaded = true;

      vm.selectName('cool-app');

      expect(vm.secret).to.eql([]);
      expect(vm.secretLoaded).to.be.false;

      loadPromise.resolve({ FIELD1: 'value1', FIELD2: 'value2' });
      await flushPromises();

      expect(vm.secret).to.eql([{ key: 'FIELD1', value: 'value1' }, { key: 'FIELD2', value: 'value2' }]);
      expect(vm.secretLoaded).to.be.true;
    });

    it('should not set name field when user cancels a change', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD1: 'value1', FIELD2: 'value2' });
      sinon.stub(notificationDisplayer, 'shouldChangesBeDiscarded').resolves(false);
      const { vm } = await loadApp();
      vm.secretNamespace = 'some-namespace';
      vm.secretName = 'cool-app';
      vm.originalSecret = { FIELD: 'value' };
      vm.secret = [{ key: 'FIELD', value: 'new-value' }];

      await vm.selectName('other-app');

      expect(vm.secretName).to.eql('cool-app');
    });

    it('should set name field when user discards unsaved changes', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD1: 'value1', FIELD2: 'value2' });
      sinon.stub(notificationDisplayer, 'shouldChangesBeDiscarded').resolves(true);
      const { vm } = await loadApp();
      vm.secretNamespace = 'some-namespace';
      vm.secretName = 'cool-app';
      vm.originalSecret = { FIELD: 'value' };
      vm.secret = [{ key: 'FIELD', value: 'new-value' }];

      await vm.selectName('other-app');

      expect(vm.secretName).to.eql('other-app');
    });

    it('should not ask for user confirmation when there are no changes in the secret', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD1: 'value1', FIELD2: 'value2' });
      sinon.stub(notificationDisplayer, 'shouldChangesBeDiscarded').resolves(true);
      const { vm } = await loadApp();
      vm.secretNamespace = 'some-namespace';
      vm.secretName = 'cool-app';
      vm.originalSecret = { FIELD: 'value' };
      vm.secret = [{ key: 'FIELD', value: 'value' }];

      await vm.selectName('other-app');

      expect(notificationDisplayer.shouldChangesBeDiscarded).to.not.have.been.called;
    });
  });

  describe('#loadSelectedBackup', () => {
    it('should replace loaded secret with backup', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      const { vm } = await loadApp();
      vm.originalSecret = { FIELD1: 'val1', FIELD2: 'val2' };
      vm.secret = [{ key: 'FIELD1', value: 'val1' }, { key: 'FIELD2', value: 'val2' }];

      await vm.loadSelectedBackup({ data: { FIELD1: 'val0', FIELD3: 'val3' }, backupTime: '2020-09-19T22:17:01.891Z' });

      expect(vm.secret).to.eql([{ key: 'FIELD1', value: 'val0' }, { key: 'FIELD3', value: 'val3' }]);
    });

    it('should update selected backup time', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      const { vm } = await loadApp();

      await vm.loadSelectedBackup({ data: { FIELD1: 'val0', FIELD3: 'val3' }, backupTime: '2020-09-19T22:17:01.891Z' });

      expect(vm.selectedBackupTime).to.eql('2020-09-19T22:17:01.891Z');
    });

    it('should display notification', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(notificationDisplayer, 'backupSuccess');
      const { vm } = await loadApp();

      vm.loadSelectedBackup({ data: { FIELD1: 'value0' }, backupTime: '2020-09-19T00:00:00.000Z' });

      expect(notificationDisplayer.backupSuccess).to.have.been.called;
    });

    it('should not replace secret when user cancels a change', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(notificationDisplayer, 'shouldChangesBeDiscarded').resolves(false);
      const { vm } = await loadApp();
      vm.originalSecret = { FIELD: 'original-value' };
      vm.secret = [{ key: 'FIELD', value: 'modified-value' }];

      await vm.loadSelectedBackup({ data: { FIELD: 'backup-value' }, backupTime: '2020-09-19T22:17:01.891Z' });

      expect(vm.secret).to.eql([{ key: 'FIELD', value: 'modified-value' }]);
    });

    it('should replace secret when user discards unsaved changes', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(notificationDisplayer, 'shouldChangesBeDiscarded').resolves(true);
      const { vm } = await loadApp();
      vm.originalSecret = { FIELD: 'original-value' };
      vm.secret = [{ key: 'FIELD', value: 'modified-value' }];

      await vm.loadSelectedBackup({ data: { FIELD: 'backup-value' }, backupTime: '2020-09-19T22:17:01.891Z' });

      expect(vm.secret).to.eql([{ key: 'FIELD', value: 'backup-value' }]);
    });

    it('should replace secret without confirmation when there are no changes in the secret', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(notificationDisplayer, 'shouldChangesBeDiscarded');
      const { vm } = await loadApp();
      vm.originalSecret = { FIELD: 'original-value' };
      vm.secret = [{ key: 'FIELD', value: 'original-value' }];

      await vm.loadSelectedBackup({ data: { FIELD: 'backup-value' }, backupTime: '2020-09-19T22:17:01.891Z' });

      expect(vm.secret).to.eql([{ key: 'FIELD', value: 'backup-value' }]);
      expect(notificationDisplayer.shouldChangesBeDiscarded).to.not.have.been.called;
    });
  });

  describe('#reloadSecret', () => {
    it('should not load secret when user cancels a change', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD: 'loaded-value' });
      sinon.stub(notificationDisplayer, 'shouldChangesBeDiscarded').resolves(false);
      const { vm } = await loadApp();
      vm.secretNamespace = 'space';
      vm.secretName = 'name';
      vm.originalSecret = { FIELD: 'original-value' };
      vm.secret = [{ key: 'FIELD', value: 'changed-value' }];

      await vm.reloadSecret();

      expect(vm.secret).to.eql([{ key: 'FIELD', value: 'changed-value' }]);
    });

    it('should load secret when user discards unsaved changes', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD: 'loaded-value' });
      sinon.stub(notificationDisplayer, 'shouldChangesBeDiscarded').resolves(true);
      const { vm } = await loadApp();
      vm.secretNamespace = 'space';
      vm.secretName = 'name';
      vm.originalSecret = { FIELD: 'original-value' };
      vm.secret = [{ key: 'FIELD', value: 'changed-value' }];

      await vm.reloadSecret();

      expect(vm.secret).to.eql([{ key: 'FIELD', value: 'loaded-value' }]);
    });

    it('should load secret without confirmation when there are no changes in the secret', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD: 'loaded-value' });
      sinon.stub(notificationDisplayer, 'shouldChangesBeDiscarded');
      const { vm } = await loadApp();
      vm.secretNamespace = 'space';
      vm.secretName = 'name';
      vm.originalSecret = { FIELD: 'original-value' };
      vm.secret = [{ key: 'FIELD', value: 'original-value' }];

      await vm.reloadSecret();

      expect(vm.secret).to.eql([{ key: 'FIELD', value: 'loaded-value' }]);
      expect(notificationDisplayer.shouldChangesBeDiscarded).to.not.have.been.called;
    });
  });

  describe('#loadSecret', () => {
    it('should not load secret when no secret is selected', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret');
      const { vm } = await loadApp();
      vm.secretNamespace = '';
      vm.secretName = '';

      await vm.loadSecret();

      expect(kubernetesClient.loadSecret).to.not.have.been.called;
    });

    it('should transform loaded secret', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD1: 'value1', FIELD2: 'value2' });
      const { vm } = await loadApp();
      vm.secretNamespace = 'space';
      vm.secretName = 'name';

      await vm.loadSecret();

      expect(vm.secret).to.eql([{ key: 'FIELD1', value: 'value1' }, { key: 'FIELD2', value: 'value2' }]);
    });

    it('should store original secret without transformation', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD1: 'value1', FIELD2: 'value2' });
      const { vm } = await loadApp();
      vm.secretNamespace = 'space';
      vm.secretName = 'name';

      await vm.loadSecret();

      expect(vm.originalSecret).to.eql({ FIELD1: 'value1', FIELD2: 'value2' });
    });

    it('should indicate loading', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({});
      const { vm } = await loadApp();
      vm.secretNamespace = 'space';
      vm.secretName = 'name';

      expect(vm.loading.secretLoad).to.eql(false);
      const loadingPromise = vm.loadSecret();
      expect(vm.loading.secretLoad).to.eql(true);
      await loadingPromise;
      expect(vm.loading.secretLoad).to.eql(false);
    });

    it('should load backups also', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({});
      const { vm } = await loadApp();
      vm.secretNamespace = 'space';
      vm.secretName = 'name';

      await vm.loadSecret();

      expect(kubernetesClient.loadSecret).to.have.been.calledTwice;
      expect(kubernetesClient.loadSecret).to.have.been.calledWith('space', 'name');
      expect(kubernetesClient.loadSecret).to.have.been.calledWith('space', 'name-backup');
    });
  });

  describe('#loadBackups', () => {
    it('should load backups for selected secret', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves(
        { BACKUP: '[{ "data": { "FIELD": "value" }, "backupTime": "2020-09-20T22:17:01.891Z"}]' }
      );
      const { vm } = await loadApp();
      vm.secretNamespace = 'namespace';
      vm.secretName = 'name';

      await vm.loadBackups();

      expect(kubernetesClient.loadSecret).to.have.been.calledWith('namespace', 'name-backup');
      expect(vm.$store.state.backups).to.eql([{ data: { FIELD: 'value' }, backupTime: '2020-09-20T22:17:01.891Z' }]);
    });

    it('should set selectedBackupTime based on the first backup', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({
        BACKUP: JSON.stringify([
          { 'data': { 'FIELD': 'value' }, 'backupTime': '2020-09-20T22:17:01.891Z' },
          { 'data': { 'FIELD': 'old-value' }, 'backupTime': '2020-09-19T22:17:01.891Z' }
        ])
      });
      const { vm } = await loadApp();
      vm.secretNamespace = 'namespace';
      vm.secretName = 'name';

      await vm.loadBackups();

      expect(vm.selectedBackupTime).to.eql('2020-09-20T22:17:01.891Z');
    });

    it('should filter out backups with invalid format', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves(
        { BACKUP: '[{ "data": { "FIELD": "value" }, "backupTime": "2020-09-20T22:17:01.891Z"}, { "FIELD": "value" }]' }
      );
      const { vm } = await loadApp();
      vm.secretNamespace = 'namespace';
      vm.secretName = 'name';

      await vm.loadBackups();

      expect(kubernetesClient.loadSecret).to.have.been.calledWith('namespace', 'name-backup');
      expect(vm.$store.state.backups).to.eql([{ data: { FIELD: 'value' }, backupTime: '2020-09-20T22:17:01.891Z' }]);
    });

    it('should set backups empty when response is not a valid JSON', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ BACKUP: '[' });
      const { vm } = await loadApp();

      await vm.loadBackups();

      expect(vm.$store.state.backups).to.eql([]);
      expect(vm.selectedBackupTime).to.be.null;
    });

    it('should set backups empty when secret does not exist', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').rejects(new Error('secret does not exist'));
      const { vm } = await loadApp();

      await vm.loadBackups();

      expect(vm.$store.state.backups).to.eql([]);
    });
  });

  describe('#openSaveConfirmationDialog', () => {
    it('should open confirmation dialog when secret is loaded', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);

      const wrapper = await mountWithStore(App);
      await flushPromises();
      wrapper.vm.secretLoaded = true;
      wrapper.vm.secret = [{ key: 'NEW_FIELD', value: 'new value' }];

      await wrapper.vm.openSaveConfirmationDialog();

      expect(wrapper.vm.$refs.saveConfirmationDialog.opened).to.eql(true);
    });

    it('should keep confirmation dialog closed when secret is not loaded', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);

      const wrapper = await mountWithStore(App);
      await flushPromises();
      wrapper.vm.secretLoaded = false;

      await wrapper.vm.openSaveConfirmationDialog();

      expect(wrapper.vm.$refs.saveConfirmationDialog.opened).to.eql(false);
    });
  });

  describe('#saveSecret', () => {
    it('should store successfully saved secret as original secret', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD: 'value' });
      sinon.stub(kubernetesClient, 'saveSecret').resolves();
      sinon.stub(kubernetesClient, 'patchDeployments').resolves();
      const { vm } = await loadApp();
      vm.secretLoaded = true;
      vm.originalSecret = { FIELD: 'value' };
      vm.secret = [{ key: 'FIELD', value: 'new-value' }];

      await vm.saveSecret();

      expect(vm.originalSecret).to.eql({ FIELD: 'new-value' });
    });

    it('should reload backups', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD: 'value' });
      sinon.stub(kubernetesClient, 'saveSecret').resolves();
      sinon.stub(kubernetesClient, 'patchDeployments').resolves();
      const { vm } = await loadApp();
      vm.secretNamespace = 'team';
      vm.secretName = 'app';
      vm.secretLoaded = true;
      vm.originalSecret = { FIELD: 'value' };

      await vm.saveSecret();

      expect(kubernetesClient.loadSecret).to.have.been.calledWith('team', 'app');
      expect(kubernetesClient.loadSecret).to.have.been.calledWith('team', 'app-backup');
    });

    it('should not modify original secret when save fails', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      sinon.stub(kubernetesClient, 'loadSecret').resolves({ FIELD: 'value' });
      sinon.stub(kubernetesClient, 'saveSecret').rejects(new Error('oh no!'));
      const { vm } = await loadApp();
      vm.secretLoaded = true;
      vm.originalSecret = { FIELD: 'value' };
      vm.secret = [{ key: 'FIELD', value: 'new-value' }];

      await vm.saveSecret();

      expect(vm.originalSecret).to.eql({ FIELD: 'value' });
    });
  });

  describe('#restartService', () => {
    it('should patch deployments related to the loaded secret', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'patchDeployments').resolves();
      const { vm } = await loadApp();
      vm.secretNamespace = 'awesome-namespace';
      vm.secretName = 'amazing-name';

      await vm.restartService();

      expect(kubernetesClient.patchDeployments).to.have.been.calledWith('awesome-namespace', 'amazing-name');
    });

    it('should set loading flag properly', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'patchDeployments').resolves();
      const { vm } = await loadApp();
      vm.secretNamespace = 'awesome-namespace';
      vm.secretName = 'amazing-name';

      const promise = vm.restartService();
      expect(vm.loading.serviceRestart).to.be.true;
      await promise;
      expect(vm.loading.serviceRestart).to.be.false;
    });

    it('should patch deployments related to the loaded secret', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'patchDeployments').resolves();
      sinon.stub(notificationDisplayer, 'serviceRestartSuccess');
      const { vm } = await loadApp();
      vm.secretNamespace = 'awesome-namespace';
      vm.secretName = 'amazing-name';

      await vm.restartService();

      expect(notificationDisplayer.serviceRestartSuccess).to.have.been.called;
    });

    it('should notify user about failure', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'patchDeployments').rejects(new Error('oh snap!'));
      sinon.stub(notificationDisplayer, 'serviceRestartFailed');
      const { vm } = await loadApp();
      vm.secretNamespace = 'awesome-namespace';
      vm.secretName = 'amazing-name';

      await vm.restartService();

      expect(notificationDisplayer.serviceRestartFailed).to.have.been.called;
    });
  });

  describe('#initialize', () => {
    it('should load context data when a valid value is stored on local storage', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves(['staging', 'production', 'test']);
      sinon.stub(kubernetesClient, 'setContext');
      localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_CONTEXT] = 'production';
      const { vm } = await loadApp();

      await vm.initialize();

      expect(vm.contextList).to.eql(['staging', 'production', 'test']);
      expect(vm.context).to.eql('production');
      expect(kubernetesClient.setContext).to.have.been.calledWith('production');
    });

    it('should load context data when the local storage value is not valid', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves(['staging', 'production', 'test']);
      sinon.stub(kubernetesClient, 'getContext').resolves('staging');
      localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_CONTEXT] = 'some unknown value';
      const { vm } = await loadApp();

      await vm.initialize();

      expect(vm.contextList).to.eql(['staging', 'production', 'test']);
      expect(vm.context).to.eql('staging');
    });

    it('should load available namespaces', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves(['namespace1', 'namespace2']);
      const { vm } = await loadApp();

      await vm.initialize();

      expect(vm.namespaceList).to.eql(['namespace1', 'namespace2']);
    });

    it('should select last used namespace and name', async () => {
      localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_NAMESPACE] = 'namespace2';
      localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_NAME] = 'secret1';
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves(['namespace1', 'namespace2']);
      sinon.stub(kubernetesClient, 'listSecrets').resolves(['secret1', 'secret2']);
      const { vm } = await loadApp();

      await vm.initialize();

      expect(vm.secretNamespace).to.eql('namespace2');
      expect(vm.secretName).to.eql('secret1');
    });
  });

  describe('#updateIsDarkModeActiveState', () => {
    it('should set isDarkModeActive state after initialization', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      const wrapper = await loadApp();
      const themeSwitcher = wrapper.find('e-theme-switcher');

      themeSwitcher.element.state = { colorTheme: 'light' };
      themeSwitcher.trigger('change');
      expect(wrapper.vm.$store.state.isDarkModeActive).to.eql(false);

      themeSwitcher.element.state = { colorTheme: 'dark' };
      themeSwitcher.trigger('change');
      expect(wrapper.vm.$store.state.isDarkModeActive).to.eql(true);
    });
  });

  describe('#selectLastUsedNamespaceAndName', () => {
    it('should not select anything when local storage is empty', async () => {
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves([]);
      const { vm } = await loadApp();

      await vm.selectLastUsedNamespaceAndName();

      expect(vm.secretNamespace).to.eql('');
      expect(vm.secretName).to.eql('');
    });

    it('should not select anything when namespace is present in local storage but it is not available', async () => {
      localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_NAMESPACE] = 'namespace666';
      sinon.stub(kubernetesClient, 'listContexts').resolves([]);
      sinon.stub(kubernetesClient, 'listNamespaces').resolves(['namespace1', 'namespace2']);
      const { vm } = await loadApp();

      await vm.selectLastUsedNamespaceAndName();

      expect(vm.secretNamespace).to.eql('');
      expect(vm.secretName).to.eql('');
    });

    describe('when namespace is present in local storage and it is available', () => {
      it('should select only namespace when name is not present in local storage', async () => {
        localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_NAMESPACE] = 'namespace2';
        sinon.stub(kubernetesClient, 'listContexts').resolves([]);
        sinon.stub(kubernetesClient, 'listNamespaces').resolves(['namespace1', 'namespace2']);
        const { vm } = await loadApp();

        await vm.selectLastUsedNamespaceAndName();

        expect(vm.secretNamespace).to.eql('namespace2');
        expect(vm.secretName).to.eql('');
      });

      it('should select only namespace when name is present in local storage but it is not available', async () => {
        localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_NAMESPACE] = 'namespace2';
        localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_NAME] = 'secret666';
        sinon.stub(kubernetesClient, 'listContexts').resolves([]);
        sinon.stub(kubernetesClient, 'listNamespaces').resolves(['namespace1', 'namespace2']);
        sinon.stub(kubernetesClient, 'listSecrets').resolves(['secret1', 'secret2']);
        const { vm } = await loadApp();

        await vm.selectLastUsedNamespaceAndName();

        expect(vm.secretNamespace).to.eql('namespace2');
        expect(vm.secretName).to.eql('');
      });

      it('should select namespace and name when name is present in local storage and it is available', async () => {
        localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_NAMESPACE] = 'namespace2';
        localStorage[LOCALSTORAGE_KEY_LAST_SELECTED_NAME] = 'secret1';
        sinon.stub(kubernetesClient, 'listContexts').resolves([]);
        sinon.stub(kubernetesClient, 'listNamespaces').resolves(['namespace1', 'namespace2']);
        sinon.stub(kubernetesClient, 'listSecrets').resolves(['secret1', 'secret2']);
        const { vm } = await loadApp();

        await vm.selectLastUsedNamespaceAndName();

        expect(vm.secretNamespace).to.eql('namespace2');
        expect(vm.secretName).to.eql('secret1');
      });
    });
  });
});

const loadApp = async () => {
  const wrapper = shallowMountWithStore(App);
  await flushPromises();
  return wrapper;
};

const resolvablePromise = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolveCallback, rejectCallback) => {
    resolve = resolveCallback;
    reject = rejectCallback;
  });
  promise.resolve = resolve;
  promise.reject = reject;
  return promise;
};
