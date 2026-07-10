const { CoreApiClient } = require('@storymee/api-client');
const client = new CoreApiClient({ baseURL: 'http://localhost:5100/internal/v1/team', enforceApiPrefix: false });
client.get('/hr/team-members').then(console.log).catch(err => console.error(err.message, err.data));
