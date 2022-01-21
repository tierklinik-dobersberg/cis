package statsapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/dbutils"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

func Setup(grp gin.IRouter) {
	router := app.NewRouter(grp)
	// GET /api/stats/v1/:collection/group-by-time/:key?from=&to=&timeRange=
	GroupByOverTimeEndpoint(router)

	// GET /api/stats/v1/:collection/group-by/:key
	GroupByEndpoint(router)

	// GET /api/stats/v1/:collection/count/:key
	CountEndpoint(router)
}

func getStatsBuilder(collection string, app *app.App) (*dbutils.Stats, error) {
	lm := map[string]interface{ Stats() *dbutils.Stats }{
		"customer": app.Customers,
		"calllogs": app.CallLogs,
	}

	stats, ok := lm[collection]
	if !ok {
		return nil, httperr.InvalidParameter("collection", collection)
	}
	return stats.Stats(), nil
}
