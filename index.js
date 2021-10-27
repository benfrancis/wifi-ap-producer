const DBus = require('dbus');

const Network = {
  systemBus: null, // Connection to system bus (dBus)
  wifiAdapter: null, // Primary Wi-Fi adapter (object path)

  /**
   * Start network manager by opening connection to system bus and finding
   * primary Wi-Fi adapter.
   *
   * @returns {Promise} Resolves on successfully finding Wi-Fi adapter.
   */
  start: function() {
    return new Promise((resolve, reject) => {
      console.log('Starting network manager...');

      try {
        this.systemBus = DBus.getBus('system');
      } catch (error) {
        console.error('Failed to access system bus ' + error);
        reject();
      }

      this.getWiFiDevices().then((wifiDevices) => {
        if(wifiDevices.length > 0) {
          this.wifiAdapter = wifiDevices[0];
            resolve();
        } else {
          reject();
        }
      }).catch((error) => {
        console.error('Unable to find a Wi-Fi adapter: ' + error);
        reject();
      });
    });
  },

  /**
   * Creates a Wi-Fi Access Point for clients to connect to in order to carry
   * out first time setup.
   */
  createWifiAccessPoint: function(ssid) {
    return new Promise((resolve, reject) => {
      this.systemBus.getInterface('org.freedesktop.NetworkManager',
        '/org/freedesktop/NetworkManager',
        'org.freedesktop.NetworkManager',
        (error, interface) => {

        if (error) {
          reject(error);
        }

        // Convert SSID to an array of bytes
        let ssidBytes = Buffer.from(ssid);

        // Access point connection information
        let connectionInfo = {
          '802-11-wireless': {
            'ssid': ssidBytes,
            'mode': 'ap',
            //'band': 'bg',
            //'hidden': false
          },
          //'802-11-wireless-security': {
          //  'key-mgmt': 'wpa-psk',
          //  'psk': 'password',
          //},
          'connection': {
            'id': ssid,
            'autoconnect': false,
            'type': '802-11-wireless',
            //'inteface-name': 'wlan0',
          },
          'ipv4': {
            'method': 'manual',
            'address-data': {
              'address': '192.168.2.1',
              'prefix': 24,
            }
          }
        };

        interface.AddAndActivateConnection(connectionInfo, this.wifiAdapter, '/',
          function(error, value) {
          if (error) {
            console.error(error);
            reject(error);
          }
          resolve(value);
        });

      });
    });
  },

  /**
   * Get a list of network adapters from the system network manager.
   *
   * @returns {Promise<Array>} Resolves with an array of object paths.
   */
  getDevices: function() {
    return new Promise((resolve, reject) => {
      if (!this.systemBus) {
        reject('System bus not available');
      }
      this.systemBus.getInterface('org.freedesktop.NetworkManager',
        '/org/freedesktop/NetworkManager',
        'org.freedesktop.NetworkManager',
        function(error, interface) {
        if (error) {
          reject(error);
        }
        interface.GetAllDevices(function(error, result) {
          if (error) {
            reject(error);
          }
          resolve(result);
        });
      });
    });
  },

  /**
   * Get a list of Wi-Fi adapters from the system network manager.
   *
   * @returns {Promise<Array>} Resolves with an array of object paths.
   */
  getWiFiDevices: async function() {
    // Get a list of all network adapter devices
    let devices = await this.getDevices();

    // Request the device type of all devices
    let deviceTypeRequests = [];
    devices.forEach((device) => {
      deviceTypeRequests.push(this.getDeviceType(device));
    });
    let deviceTypes = await Promise.all(deviceTypeRequests);

    // Look for all the devices with a type of 2 (Wi-Fi)
    let wifiDevices = [];
    for (i in deviceTypes) {
      if (deviceTypes[i] == 2) {
        // Note: Array indices of both arrays should match up
        wifiDevices.push(devices[i]);
      }
    }

    // Resolve with the list of Wi-Fi devices
    return wifiDevices;
  },

  /**
   * Get the device type for a given network adapter.
   *
   * @param String id Object path for device.
   * @returns {Promise<Integer>} Resolves with a device type (2 is Wi-Fi).
   */
  getDeviceType: function(id) {
    return new Promise((resolve, reject) => {
      this.systemBus.getInterface('org.freedesktop.NetworkManager',
        id,
        'org.freedesktop.NetworkManager.Device',
        function(error, interface) {
        if (error) {
          reject(error);
        }
        interface.getProperty('DeviceType', function(error, value) {
          if (error) {
            reject(error);
          }
          resolve(value);
        });
      });
    });
  },
}

// Start network manager and create Wi-Fi access point
Network.start()
.then(() => {
  Network.createWifiAccessPoint('my-ap');
}).catch((error) => {
  console.error(error)
});