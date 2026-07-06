import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import express from 'express';
import adminRoutes from './routes/admin.routes';
import hrRoutes from './routes/hr.routes';
import omnitaskRoutes from './routes/omnitask.routes';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

app.use('/api/admin', adminRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/omnitask', omnitaskRoutes);  // Compatibility alias for storymeeteam-mcp client (CoreApiClient prepends /api)

const port = 4503;
app.listen(port, '0.0.0.0', () => {
  console.log(`[Core Team API] Server is listening on port ${port}`);
});
