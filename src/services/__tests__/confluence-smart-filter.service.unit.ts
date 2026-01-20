/**
 * Unit Tests for Confluence Smart Filter Service
 *
 * Tests keyword extraction, scoring, and filtering logic
 */

import {expect} from 'chai';
import {ConfluenceSmartFilterService} from '../confluence-smart-filter.service';

describe('ConfluenceSmartFilterService', () => {
  let service: ConfluenceSmartFilterService;

  beforeEach(() => {
    service = new ConfluenceSmartFilterService();
  });

  describe('filterPages()', () => {
    it('should filter pages by keyword matching', () => {
      // Arrange
      const jiraIssue = {
        key: 'TEST-123',
        fields: {
          summary: 'Add authentication service using JWT tokens',
          description: 'Implement JWT-based authentication for the API endpoints. Users should be able to login and receive a token.',
          labels: [],
          components: [],
        },
      };

      const pages = [
        {
          id: '1',
          title: 'Authentication Service Implementation Guide',
          body: {storage: {value: '<p>This guide covers JWT authentication implementation using LoopBack framework.</p>'}},
        },
        {
          id: '2',
          title: 'Database Schema Documentation',
          body: {storage: {value: '<p>Schema for users, roles, and permissions tables.</p>'}},
        },
        {
          id: '3',
          title: 'Frontend React Components',
          body: {storage: {value: '<p>UI components for displaying data.</p>'}},
        },
      ];

      // Act
      const results = service.filterPages(jiraIssue, pages, {maxPages: 10, minScoreThreshold: 0.1});

      // Assert
      expect(results.length).to.be.greaterThan(0);
      expect(results[0].page.id).to.equal('1');  // Auth guide should score highest
      expect(results[0].matchedBy).to.include('keywords');
    });

    it('should score pages by title similarity', () => {
      // Arrange
      const jiraIssue = {
        key: 'TEST-124',
        fields: {
          summary: 'Update user profile settings',
          description: 'Allow users to update their profile information',
          labels: [],
          components: [],
        },
      };

      const pages = [
        {
          id: '1',
          title: 'User Profile Settings API',
          body: {storage: {value: '<p>API documentation for user settings.</p>'}},
        },
        {
          id: '2',
          title: 'Admin Dashboard',
          body: {storage: {value: '<p>Admin panel documentation.</p>'}},
        },
      ];

      // Act
      const results = service.filterPages(jiraIssue, pages);

      // Assert
      expect(results.length).to.be.greaterThan(0);
      expect(results[0].page.id).to.equal('1');
      expect(results[0].matchedBy).to.include('title');
    });

    it('should respect maxPages limit', () => {
      // Arrange
      const jiraIssue = {
        key: 'TEST-125',
        fields: {
          summary: 'Test feature',
          description: 'Test description',
        },
      };

      const pages = Array.from({length: 50}, (_, i) => ({
        id: String(i + 1),
        title: `Page ${i + 1}`,
        body: {storage: {value: '<p>Test content</p>'}},
      }));

      // Act
      const results = service.filterPages(jiraIssue, pages, {maxPages: 10});

      // Assert
      expect(results.length).to.be.lessThanOrEqual(10);
    });

    it('should respect minScoreThreshold', () => {
      // Arrange
      const jiraIssue = {
        key: 'TEST-126',
        fields: {
          summary: 'Very specific feature XYZ123',
          description: 'Implement feature XYZ123 with specific requirements',
        },
      };

      const pages = [
        {
          id: '1',
          title: 'General Documentation',
          body: {storage: {value: '<p>Generic documentation page.</p>'}},
        },
        {
          id: '2',
          title: 'Feature XYZ123 Implementation',
          body: {storage: {value: '<p>Specific implementation guide for XYZ123.</p>'}},
        },
      ];

      // Act
      const results = service.filterPages(jiraIssue, pages, {minScoreThreshold: 0.5});

      // Assert
      expect(results.length).to.be.greaterThan(0);
      results.forEach(result => {
        expect(result.score).to.be.at.least(0.5);
      });
    });

    it('should handle empty Jira description gracefully', () => {
      // Arrange
      const jiraIssue = {
        key: 'TEST-127',
        fields: {
          summary: 'Fix bug',
          description: '',  // Empty description
        },
      };

      const pages = [
        {
          id: '1',
          title: 'Bug Fixes Guide',
          body: {storage: {value: '<p>Guide to fixing common bugs.</p>'}},
        },
      ];

      // Act & Assert
      expect(() => service.filterPages(jiraIssue, pages)).to.not.throw();
    });

    it('should handle pages without body content', () => {
      // Arrange
      const jiraIssue = {
        key: 'TEST-128',
        fields: {
          summary: 'Test',
          description: 'Test description',
        },
      };

      const pages = [
        {
          id: '1',
          title: 'Page without body',
          // No body field
        },
        {
          id: '2',
          title: 'Page with body',
          body: {storage: {value: '<p>Content</p>'}},
        },
      ];

      // Act & Assert
      expect(() => service.filterPages(jiraIssue, pages)).to.not.throw();
    });
  });

  describe('filterPagesWithMetrics()', () => {
    it('should return filtering metrics', () => {
      // Arrange
      const jiraIssue = {
        key: 'TEST-129',
        fields: {
          summary: 'Create API endpoint for user management',
          description: 'Add CRUD endpoints for users',
        },
      };

      const pages = Array.from({length: 20}, (_, i) => ({
        id: String(i + 1),
        title: i < 5 ? `User API ${i}` : `Other ${i}`,
        body: {storage: {value: i < 5 ? '<p>User management API</p>' : '<p>Other content</p>'}},
      }));

      // Act
      const {results, metrics} = service.filterPagesWithMetrics(jiraIssue, pages, {maxPages: 10});

      // Assert
      expect(metrics.totalPages).to.equal(20);
      expect(metrics.filteredPages).to.be.lessThanOrEqual(10);
      expect(metrics.reductionPercentage).to.be.greaterThan(0);
      expect(metrics.averageScore).to.be.greaterThan(0);
      expect(metrics.executionTimeMs).to.be.greaterThan(0);
      expect(metrics.keywordsExtracted).to.be.an('array');
      expect(metrics.matchDistribution).to.have.keys(['keywords', 'title', 'labels', 'components']);
    });

    it('should track keyword extraction in metrics', () => {
      // Arrange
      const jiraIssue = {
        key: 'TEST-130',
        fields: {
          summary: 'Implement authentication service',
          description: 'Create JWT-based authentication using OAuth2 protocol',
        },
      };

      const pages = [{id: '1', title: 'Test', body: {storage: {value: '<p>Test</p>'}}}];

      // Act
      const {metrics} = service.filterPagesWithMetrics(jiraIssue, pages);

      // Assert
      expect(metrics.keywordsExtracted).to.be.an('array');
      expect(metrics.keywordsExtracted.length).to.be.greaterThan(0);
      // Should extract technical terms like 'authentication', 'jwt', 'oauth2'
    });
  });

  describe('Edge Cases', () => {
    it('should handle Jira with labels and components', () => {
      // Arrange
      const jiraIssue = {
        key: 'TEST-131',
        fields: {
          summary: 'Feature request',
          description: 'New feature',
          labels: ['backend', 'api'],
          components: [{name: 'Authentication'}],
        },
      };

      const pages = [
        {
          id: '1',
          title: 'API Documentation',
          metadata: {labels: [{name: 'backend'}, {name: 'api'}]},
          body: {storage: {value: '<p>Authentication API</p>'}},
        },
      ];

      // Act
      const results = service.filterPages(jiraIssue, pages);

      // Assert
      expect(results.length).to.be.greaterThan(0);
      expect(results[0].matchedBy).to.include.members(['labels', 'components']);
    });

    it('should extract technical terms from camelCase', () => {
      // Arrange
      const jiraIssue = {
        key: 'TEST-132',
        fields: {
          summary: 'Update UserProfileService and AuthenticationController',
          description: 'Refactor UserProfileService to use new AuthenticationController pattern',
        },
      };

      const pages = [
        {
          id: '1',
          title: 'UserProfileService Documentation',
          body: {storage: {value: '<p>Service for managing user profiles.</p>'}},
        },
      ];

      // Act
      const results = service.filterPages(jiraIssue, pages, {debug: false});

      // Assert
      expect(results.length).to.be.greaterThan(0);
      // Should match based on technical terms extraction
    });
  });
});
