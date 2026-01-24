import { InMemoryVectorDatabase } from '../services/knowledge/vectorDatabase';
import { VectorDatabase, VectorEmbedding as _VectorEmbedding } from '../services/knowledge/vectorDatabase';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Migration Script: In-Memory to Production Vector DB
 * Migrates vectors from in-memory storage to Pinecone (or other production DB)
 */
async function migrateVectorDatabase() {
  console.log('🔄 Starting vector database migration...\n');

  // Step 1: Read from in-memory database
  console.log('📖 Step 1: Reading from in-memory database...');
  const sourceDb = new InMemoryVectorDatabase();
  await sourceDb.connect();

  const allVectors = sourceDb.getAll();
  const totalVectors = allVectors.length;

  if (totalVectors === 0) {
    console.log('⚠️  No vectors found in in-memory database.');
    console.log('   Migration skipped. Add vectors to in-memory DB first.');
    return;
  }

  console.log(`✅ Found ${totalVectors} vectors in in-memory database\n`);

  // Step 2: Initialize target database (Pinecone)
  console.log('🔌 Step 2: Connecting to production vector database...');
  const vectorDbType = process.env.VECTOR_DB_TYPE || 'memory';

  if (vectorDbType.toLowerCase() === 'memory') {
    console.log('⚠️  VECTOR_DB_TYPE is set to "memory".');
    console.log('   Set VECTOR_DB_TYPE=pinecone to migrate to Pinecone.');
    return;
  }

  // Create target database instance
  const { VectorDatabaseFactory } = await import('../services/knowledge/vectorDatabase');
  const targetDb: VectorDatabase = VectorDatabaseFactory.create();

  try {
    await targetDb.connect();
    console.log('✅ Connected to production vector database\n');
  } catch (error) {
    console.error('❌ Failed to connect to production vector database:', error);
    console.log('\n💡 Tips:');
    console.log('   - Ensure PINECONE_API_KEY is set in .env');
    console.log('   - Check your Pinecone account status');
    console.log('   - Verify VECTOR_DB_TYPE=pinecone in .env');
    throw error;
  }

  // Step 3: Transfer vectors in batches
  console.log('📤 Step 3: Transferring vectors to production database...');
  const batchSize = 100;
  let transferred = 0;
  let errors = 0;

  for (let i = 0; i < allVectors.length; i += batchSize) {
    const batch = allVectors.slice(i, i + batchSize);
    
    try {
      await targetDb.insertBatch(batch);
      transferred += batch.length;
      console.log(`   ✓ Transferred ${transferred}/${totalVectors} vectors...`);
    } catch (error) {
      console.error(`   ✗ Error transferring batch ${i}-${i + batchSize}:`, error);
      errors += batch.length;
      
      // Try inserting individually for this batch
      for (const vector of batch) {
        try {
          await targetDb.insert(vector);
          transferred++;
        } catch (individualError) {
          errors++;
          console.error(`     ✗ Failed to insert vector ${vector.id}`);
        }
      }
    }

    // Small delay to avoid rate limiting
    if (i + batchSize < allVectors.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   Total vectors: ${totalVectors}`);
  console.log(`   Transferred: ${transferred}`);
  console.log(`   Errors: ${errors}`);

  // Step 4: Verify migration
  console.log('\n🔍 Step 4: Verifying migration...');
  try {
    // Sample check - get a few random vectors
    const sampleSize = Math.min(5, totalVectors);
    const sampleVectors = allVectors.slice(0, sampleSize);
    
    let verified = 0;
    for (const vector of sampleVectors) {
      const retrieved = await targetDb.get(vector.id);
      if (retrieved && retrieved.id === vector.id) {
        verified++;
      }
    }

    console.log(`✅ Verified ${verified}/${sampleSize} sample vectors`);
  } catch (error) {
    console.warn('⚠️  Verification failed:', error);
  }

  // Step 5: Cleanup (optional - keep source for now)
  console.log('\n💾 Step 5: Migration complete');
  console.log('   Source (in-memory) database preserved for rollback');
  console.log('   Production database ready to use');

  await targetDb.disconnect();
  console.log('\n🎉 Migration finished successfully!');
}

// Run migration
migrateVectorDatabase()
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
