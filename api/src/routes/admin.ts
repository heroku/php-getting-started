import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { 
  getTelemetryData, 
  getNoResultQueries, 
  getTopQueries, 
  getClickThroughRates,
  getSynonymSuggestions,
  applySynonymRule,
  createBoostRule,
  createDemoteRule,
  getSearchRules,
  deleteRule,
  getABTestResults,
  toggleABTest
} from '../db.js';
import { 
  createJsonApiResponse, 
  createJsonApiError, 
  createHttpError 
} from '../utils/jsonapi.js';

export const router = new Hono();

// Telemetry Dashboard Endpoints

// Get overall telemetry data
router.get('/telemetry/:project',
  authMiddleware.requireKey('admin'),
  async (c) => {
    try {
      const { project } = c.req.param();
      const { from, to, period = '7d' } = c.req.query();
      
      const telemetryData = await getTelemetryData(project, {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        period
      });

      const resource = {
        type: 'telemetry',
        id: project,
        attributes: {
          total_queries: telemetryData.totalQueries,
          total_clicks: telemetryData.totalClicks,
          avg_response_time: telemetryData.avgResponseTime,
          avg_ctr: telemetryData.avgClickThroughRate,
          no_result_rate: telemetryData.noResultRate,
          period,
          generated_at: new Date().toISOString()
        },
        meta: {
          period_start: telemetryData.periodStart,
          period_end: telemetryData.periodEnd,
          data_points: telemetryData.dataPoints
        }
      };

      return c.json(createJsonApiResponse(resource));
    } catch (error) {
      console.error('Telemetry error:', error);
      return c.json(createJsonApiError(createHttpError(500, 'Failed to fetch telemetry data')), 500);
    }
  }
);

// Get no-result queries for synonym mining
router.get('/no-result-queries/:project',
  authMiddleware.requireKey('admin'),
  async (c) => {
    try {
      const { project } = c.req.param();
      const { limit = '50', period = '7d' } = c.req.query();
      
      const noResultQueries = await getNoResultQueries(project, {
        limit: parseInt(limit),
        period
      });

      const resources = noResultQueries.map((query, index) => ({
        type: 'no-result-query',
        id: `${project}-${index}`,
        attributes: {
          query: query.query,
          count: query.count,
          last_searched: query.lastSearched,
          suggested_synonyms: query.suggestedSynonyms || []
        },
        meta: {
          potential_impact: query.count * 0.1, // Estimated improvement if fixed
          priority: query.count > 10 ? 'high' : query.count > 5 ? 'medium' : 'low'
        }
      }));

      const meta = {
        total_queries: noResultQueries.length,
        period,
        generated_at: new Date().toISOString()
      };

      return c.json(createJsonApiResponse(resources, { meta }));
    } catch (error) {
      console.error('No-result queries error:', error);
      return c.json(createJsonApiError(createHttpError(500, 'Failed to fetch no-result queries')), 500);
    }
  }
);

// Get top queries with performance metrics
router.get('/top-queries/:project',
  authMiddleware.requireKey('admin'),
  async (c) => {
    try {
      const { project } = c.req.param();
      const { limit = '20', period = '7d', sort = 'count' } = c.req.query();
      
      const topQueries = await getTopQueries(project, {
        limit: parseInt(limit),
        period,
        sortBy: sort as 'count' | 'ctr' | 'response_time'
      });

      const resources = topQueries.map((query, index) => ({
        type: 'top-query',
        id: `${project}-${index}`,
        attributes: {
          query: query.query,
          count: query.count,
          avg_response_time: query.avgResponseTime,
          click_through_rate: query.clickThroughRate,
          avg_results: query.avgResults,
          last_searched: query.lastSearched
        },
        meta: {
          rank: index + 1,
          performance_score: calculatePerformanceScore(query),
          needs_optimization: query.avgResponseTime > 1000 || query.clickThroughRate < 0.1
        }
      }));

      const meta = {
        total_queries: topQueries.length,
        period,
        sort_by: sort,
        generated_at: new Date().toISOString()
      };

      return c.json(createJsonApiResponse(resources, { meta }));
    } catch (error) {
      console.error('Top queries error:', error);
      return c.json(createJsonApiError(createHttpError(500, 'Failed to fetch top queries')), 500);
    }
  }
);

// Synonym Mining and Rules Engine

// Get AI-suggested synonyms from telemetry
router.get('/synonym-suggestions/:project',
  authMiddleware.requireKey('admin'),
  async (c) => {
    try {
      const { project } = c.req.param();
      const { limit = '10', min_frequency = '5' } = c.req.query();
      
      const suggestions = await getSynonymSuggestions(project, {
        limit: parseInt(limit),
        minFrequency: parseInt(min_frequency)
      });

      const resources = suggestions.map((suggestion, index) => ({
        type: 'synonym-suggestion',
        id: `${project}-${index}`,
        attributes: {
          source_query: suggestion.sourceQuery,
          suggested_synonyms: suggestion.suggestedSynonyms,
          confidence: suggestion.confidence,
          impact_estimate: suggestion.impactEstimate,
          frequency: suggestion.frequency
        },
        meta: {
          auto_applicable: suggestion.confidence > 0.8,
          review_required: suggestion.confidence < 0.6
        }
      }));

      const meta = {
        total_suggestions: suggestions.length,
        generated_at: new Date().toISOString()
      };

      return c.json(createJsonApiResponse(resources, { meta }));
    } catch (error) {
      console.error('Synonym suggestions error:', error);
      return c.json(createJsonApiError(createHttpError(500, 'Failed to fetch synonym suggestions')), 500);
    }
  }
);

// Apply synonym rule
const applySynonymSchema = z.object({
  source_terms: z.array(z.string()).min(1),
  target_terms: z.array(z.string()).min(1),
  type: z.enum(['bidirectional', 'oneway']).default('bidirectional'),
  auto_apply: z.boolean().default(false)
});

router.post('/synonym-rules/:project',
  authMiddleware.requireKey('admin'),
  zValidator('json', applySynonymSchema),
  async (c) => {
    try {
      const { project } = c.req.param();
      const { source_terms, target_terms, type, auto_apply } = await c.req.json();
      
      const rule = await applySynonymRule(project, {
        sourceTerms: source_terms,
        targetTerms: target_terms,
        type,
        autoApply: auto_apply
      });

      const resource = {
        type: 'synonym-rule',
        id: rule.id,
        attributes: {
          source_terms: rule.sourceTerms,
          target_terms: rule.targetTerms,
          type: rule.type,
          status: rule.status,
          created_at: rule.createdAt,
          auto_applied: rule.autoApplied
        },
        meta: {
          estimated_queries_affected: rule.estimatedQueriesAffected
        }
      };

      return c.json(createJsonApiResponse(resource), 201);
    } catch (error) {
      console.error('Apply synonym rule error:', error);
      return c.json(createJsonApiError(createHttpError(500, 'Failed to apply synonym rule')), 500);
    }
  }
);

// Boost/Demote Rules Engine

const boostRuleSchema = z.object({
  query_pattern: z.string(),
  document_ids: z.array(z.string()).optional(),
  collections: z.array(z.string()).optional(),
  boost_factor: z.number().min(0.1).max(10).default(2.0),
  conditions: z.record(z.any()).optional(),
  active: z.boolean().default(true)
});

router.post('/boost-rules/:project',
  authMiddleware.requireKey('admin'),
  zValidator('json', boostRuleSchema),
  async (c) => {
    try {
      const { project } = c.req.param();
      const payload = await c.req.json();
      
      const rule = await createBoostRule(project, {
        queryPattern: payload.query_pattern,
        documentIds: payload.document_ids,
        collections: payload.collections,
        boostFactor: payload.boost_factor,
        conditions: payload.conditions,
        active: payload.active
      });

      const resource = {
        type: 'boost-rule',
        id: rule.id,
        attributes: {
          query_pattern: rule.queryPattern,
          document_ids: rule.documentIds,
          collections: rule.collections,
          boost_factor: rule.boostFactor,
          conditions: rule.conditions,
          active: rule.active,
          created_at: rule.createdAt,
          queries_matched: rule.queriesMatched
        }
      };

      return c.json(createJsonApiResponse(resource), 201);
    } catch (error) {
      console.error('Create boost rule error:', error);
      return c.json(createJsonApiError(createHttpError(500, 'Failed to create boost rule')), 500);
    }
  }
);

const demoteRuleSchema = z.object({
  query_pattern: z.string(),
  document_ids: z.array(z.string()).optional(),
  collections: z.array(z.string()).optional(),
  demote_factor: z.number().min(0.1).max(1).default(0.5),
  conditions: z.record(z.any()).optional(),
  active: z.boolean().default(true)
});

router.post('/demote-rules/:project',
  authMiddleware.requireKey('admin'),
  zValidator('json', demoteRuleSchema),
  async (c) => {
    try {
      const { project } = c.req.param();
      const payload = await c.req.json();
      
      const rule = await createDemoteRule(project, {
        queryPattern: payload.query_pattern,
        documentIds: payload.document_ids,
        collections: payload.collections,
        demoteFactor: payload.demote_factor,
        conditions: payload.conditions,
        active: payload.active
      });

      const resource = {
        type: 'demote-rule',
        id: rule.id,
        attributes: {
          query_pattern: rule.queryPattern,
          document_ids: rule.documentIds,
          collections: rule.collections,
          demote_factor: rule.demoteFactor,
          conditions: rule.conditions,
          active: rule.active,
          created_at: rule.createdAt,
          queries_matched: rule.queriesMatched
        }
      };

      return c.json(createJsonApiResponse(resource), 201);
    } catch (error) {
      console.error('Create demote rule error:', error);
      return c.json(createJsonApiError(createHttpError(500, 'Failed to create demote rule')), 500);
    }
  }
);

// Get all search rules
router.get('/rules/:project',
  authMiddleware.requireKey('admin'),
  async (c) => {
    try {
      const { project } = c.req.param();
      const { type, active } = c.req.query();
      
      const rules = await getSearchRules(project, {
        type: type as 'boost' | 'demote' | 'synonym' | undefined,
        active: active ? active === 'true' : undefined
      });

      const resources = rules.map(rule => ({
        type: rule.type + '-rule',
        id: rule.id,
        attributes: {
          ...rule,
          created_at: rule.createdAt,
          updated_at: rule.updatedAt
        },
        meta: {
          performance_impact: rule.performanceImpact,
          queries_affected: rule.queriesAffected
        }
      }));

      const meta = {
        total_rules: rules.length,
        active_rules: rules.filter(r => r.active).length,
        generated_at: new Date().toISOString()
      };

      return c.json(createJsonApiResponse(resources, { meta }));
    } catch (error) {
      console.error('Get rules error:', error);
      return c.json(createJsonApiError(createHttpError(500, 'Failed to fetch rules')), 500);
    }
  }
);

// Delete rule
router.delete('/rules/:project/:ruleId',
  authMiddleware.requireKey('admin'),
  async (c) => {
    try {
      const { project, ruleId } = c.req.param();
      
      await deleteRule(project, ruleId);
      
      return c.json({ message: 'Rule deleted successfully' });
    } catch (error) {
      console.error('Delete rule error:', error);
      return c.json(createJsonApiError(createHttpError(500, 'Failed to delete rule')), 500);
    }
  }
);

// A/B Testing for Re-ranker

// Get A/B test results
router.get('/ab-tests/:project',
  authMiddleware.requireKey('admin'),
  async (c) => {
    try {
      const { project } = c.req.param();
      const { period = '7d' } = c.req.query();
      
      const abTestResults = await getABTestResults(project, { period });

      const resources = abTestResults.map(test => ({
        type: 'ab-test',
        id: test.id,
        attributes: {
          name: test.name,
          description: test.description,
          variant_a: test.variantA,
          variant_b: test.variantB,
          traffic_split: test.trafficSplit,
          status: test.status,
          start_date: test.startDate,
          end_date: test.endDate,
          results: {
            variant_a_ctr: test.results.variantACTR,
            variant_b_ctr: test.results.variantBCTR,
            statistical_significance: test.results.statisticalSignificance,
            winner: test.results.winner,
            improvement: test.results.improvement
          }
        },
        meta: {
          sample_size_a: test.results.sampleSizeA,
          sample_size_b: test.results.sampleSizeB,
          confidence_level: test.results.confidenceLevel,
          is_conclusive: test.results.isConclusive
        }
      }));

      return c.json(createJsonApiResponse(resources));
    } catch (error) {
      console.error('A/B test results error:', error);
      return c.json(createJsonApiError(createHttpError(500, 'Failed to fetch A/B test results')), 500);
    }
  }
);

// Toggle A/B test
const toggleABTestSchema = z.object({
  test_name: z.string(),
  enabled: z.boolean()
});

router.post('/ab-tests/:project/toggle',
  authMiddleware.requireKey('admin'),
  zValidator('json', toggleABTestSchema),
  async (c) => {
    try {
      const { project } = c.req.param();
      const { test_name, enabled } = await c.req.json();
      
      const result = await toggleABTest(project, test_name, enabled);

      const resource = {
        type: 'ab-test-toggle',
        id: result.id,
        attributes: {
          test_name: result.testName,
          enabled: result.enabled,
          updated_at: result.updatedAt
        }
      };

      return c.json(createJsonApiResponse(resource));
    } catch (error) {
      console.error('Toggle A/B test error:', error);
      return c.json(createJsonApiError(createHttpError(500, 'Failed to toggle A/B test')), 500);
    }
  }
);

// Helper function to calculate performance score
function calculatePerformanceScore(query: any): number {
  const responseTimeScore = Math.max(0, 1 - (query.avgResponseTime / 2000)); // 2s = 0 score
  const ctrScore = Math.min(1, query.clickThroughRate * 5); // 0.2 CTR = 1.0 score
  const resultsScore = Math.min(1, query.avgResults / 10); // 10 results = 1.0 score
  
  return Math.round((responseTimeScore * 0.3 + ctrScore * 0.5 + resultsScore * 0.2) * 100) / 100;
}