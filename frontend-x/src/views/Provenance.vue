<template>
  <v-card
    class="mx-auto"
    style="height: 100%; height: 100%; display: flex; flex-direction: column"
    :elevation="3"
  >
    <template v-slot:title>
      <div class="clearfix">
        <div style="width: 50%; float: left; padding: 0.1em">
          Provenance Data Graph
        </div>
      </div>
    </template>
    <v-divider></v-divider>
    <v-card-text>
      <div id="graphbox"></div>
      <div id="controls">
        <v-btn id="zinbtn" size="small" class="ml-2" variant="outlined">
          <v-icon icon="mdi-magnify-plus-outline"></v-icon
        ></v-btn>
        <v-btn id="zoutbtn" size="small" class="ml-2" variant="outlined">
          <v-icon icon="mdi-magnify-minus-outline"></v-icon
        ></v-btn>
        <v-btn id="rsbtn" size="small" class="ml-2" variant="outlined">
          <v-icon icon="mdi-autorenew"></v-icon
        ></v-btn>
      </div>
      <div id="search">
        <v-text-field
          clearable
          label="Search by ID/Ticket"
          prepend-icon="mdi-magnify"
          variant="underlined"
          density="compact"
          hint="(fuzzy on lower case & startswith)"
          persistent-hint
          v-model="searching"
          @keydown="searchNode"
        ></v-text-field>
      </div>
      <div id="legend" class="unselectable">
        <div v-for="[key, item] of Object.entries(legend)" :key="key">
          <v-icon :color="item.color" icon="mdi-checkbox-blank"></v-icon>
          <div class="legendTitle">
            {{ item.title }}
          </div>
        </div>
      </div>
    </v-card-text>

    <Transition name="fade" mode="out-in">
      <v-card
        theme="dark"
        id="nodeDetails"
        v-if="viewNodeDetails"
        class="mx-auto"
        width="500"
        height="300"
        prepend-icon="mdi-file-table-outline"
        :style="{
          right: 0 + 'px',
          bottom: 0 + 'px',
        }"
      >
        <template v-slot:title>
          <v-btn
            size="small"
            color="primary"
            variant="outlined"
            style="float: left"
          >
            {{ currentNode.attributes.node_type }} |
            {{ currentNode.key }}</v-btn
          >
          <Transition name="fade" mode="out-in">
            <v-btn
              v-if="false"
              size="small"
              color="error"
              variant="outline"
              style="float: right"
              @click="hideNodeDetails(true)"
            >
              <v-icon icon="mdi-close"></v-icon
            ></v-btn>
          </Transition>
        </template>

        <v-card-text style="overflow-y: auto">
          <v-table density="compact" width="400">
            <thead>
              <tr>
                <th class="text-left">Key</th>
                <th class="text-left">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="attrKey in Object.keys(currentNode.attributes.info)"
                :key="attrKey"
              >
                <td>{{ attrKey }}</td>
                <td>{{ currentNode.attributes.info[attrKey] }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </Transition>
  </v-card>
</template>

<script>
import Graph from "graphology";
import Sigma from "sigma";
import { circlepack } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";
import forceLayout from "graphology-layout-force";
import ForceSupervisor from "graphology-layout-force/worker";

const legend = {
  xai_executor: {
    color: "#FFBE0B",
    title: "XAI Microservice",
  },
  model_executor: {
    color: "#FB5607",
    title: "Model Microservice",
  },
  db_executor: {
    color: "#FF006E",
    title: "DB Microservice",
  },
  evaluation_executor: {
    color: "#8338EC",
    title: "Evaluation Microservice",
  },
  xai_tasksheet: {
    color: "#3A86FF",
    title: "XAI TaskSheet",
  },
  evaluation_tasksheet: {
    color: "#F79256",
    title: "Evaluation TaskSheet",
  },
  pipeline: {
    color: "#FBD1A2",
    title: "Pipeline",
  },
  pipeline_run: {
    color: "#7DCFB6",
    title: "Pipeline Execution",
  },
  xai_task: {
    color: "#00B2CA",
    title: "XAI Task Execution",
  },
  evaluation_task: {
    color: "#1D4E89",
    title: "Evaluation Task Execution",
  },
};

export default {
  data: () => ({
    viewNodeDetails: false,
    nodeDetailsActivated: false,
    hideNodeDetailsTimeOut: undefined,
    renderer: undefined,
    layout: undefined,
    provenance: {},
    graph: undefined,
    currentNode: undefined,
    currentFocusNodeKey: [],
    currentFocusNodePackKeys: new Set([]),
    searching: "",
    hoveredEdge: undefined,
    legend,
  }),
  methods: {
    searchNode(e) {
      if (e.key === "Enter") {
        const node = this.getNodeByKey(this.searching);
        if (node !== undefined) {
          this.focusOnNode(node.key);
        } else {
          this.removeNodeFocus();
        }
        this.renderer.refresh();
      }
    },
    getNodeByKey(node_key) {
      if (node_key === "") {
        return undefined;
      }
      var get = undefined;
      this.graph.forEachNode((node, attributes) => {
        if (
          node === node_key ||
          node.toLowerCase().startsWith(node_key.toLowerCase())
        ) {
          get = {
            key: node,
            attributes,
          };
        }
      });
      return get;
    },
    showNodeDetails() {
      clearTimeout(this.hideNodeDetailsTimeOut);
      this.currentNode = this.getNodeByKey(this.currentFocusNodeKey);
      this.viewNodeDetails = true;
    },
    hideNodeDetails() {
      clearTimeout(this.hideNodeDetailsTimeOut);
      this.hideNodeDetailsTimeOut = setTimeout(() => {
        this.viewNodeDetails = false;
      }, 300);
    },
    getProvenance(cb) {
      console.log("fetch provenance");
      this.ax.get(
        `${import.meta.env.VITE_BASE_URL}/task_publisher/provenance`,
        {},
        {
          success: (response) => {
            this.provenance = response.data;
            if (cb !== undefined) {
              cb();
            }
          },
          error: () => {},
          final: () => {
            // console.log(JSON.parse(JSON.stringify(this.provenance)));
          },
        }
      );
    },
    renderCamara() {
      const camera = this.renderer.getCamera();

      const thiz = this;

      // Bind zoom manipulation buttons
      document.getElementById("zinbtn").addEventListener("click", () => {
        camera.animatedZoom({ duration: 300 });
      });
      document.getElementById("zoutbtn").addEventListener("click", () => {
        camera.animatedUnzoom({ duration: 300 });
      });
      document.getElementById("rsbtn").addEventListener("click", () => {
        thiz.removeNodeFocus();
        camera.animatedReset({ duration: 500 });
      });
    },
    getRelatedComponentType(currentNodeType, focusNodeType) {
      const upper = [
        "task",
        "pipeline_run",
        "pipeline",
        "tasksheet",
        "executor",
      ];
      if (focusNodeType === "task") {
        // if (currentNodeType === "task") {
        //   return ["pipeline_run", "tasksheet"];
        // }
        if (currentNodeType === "pipeline_run") {
          return ["task", "pipeline_run", "pipeline"];
        }
        if (currentNodeType === "pipeline") {
          return ["tasksheet"];
        }
        if (currentNodeType === "tasksheet") {
          return ["executor"];
        }
        return [];
      }

      if (focusNodeType === "pipeline_run") {
        // if (currentNodeType === "pipeline_run") {
        //   return ["task", "pipeline"];
        // }
        if (currentNodeType === "pipeline") {
          return ["tasksheet"];
        }
        if (currentNodeType === "tasksheet") {
          return ["executor"];
        }
        return [];
      }

      if (focusNodeType === "pipeline") {
        // if (currentNodeType === "pipeline") {
        //   return ["tasksheet", "pipeline_run"];
        // }
        if (currentNodeType === "pipeline_run") {
          return ["task"];
        }
        if (currentNodeType === "tasksheet") {
          return ["executor"];
        }
        return [];
      }

      if (focusNodeType === "tasksheet") {
        if (currentNodeType === "pipeline") {
          return ["tasksheet", "pipeline_run"];
        }
        if (currentNodeType === "pipeline_run") {
          return ["task"];
        }
        // if (currentNodeType === "tasksheet") {
        //   return ["executor", "pipeline"];
        // }
        return [];
      }

      if (focusNodeType === "executor") {
        // if (currentNodeType === "executor") {
        //   return ["tasksheet"];
        // }
        if (currentNodeType === "pipeline") {
          return ["pipeline_run"];
        }
        if (currentNodeType === "pipeline_run") {
          return ["task"];
        }
        if (currentNodeType === "tasksheet") {
          return ["pipeline", "task", "executor"];
        }
        return [];
      }
    },
    getRelatedNodeKeys(currentNodeKey, focusNodeKey) {
      const curentNodeNb = this.graph.neighbors(currentNodeKey);
      const currentNode = this.getNodeByKey(currentNodeKey);
      const focusNode = this.getNodeByKey(focusNodeKey);

      const relatedNodeKeys = [];

      for (const nbKey of curentNodeNb) {
        const nbNode = this.getNodeByKey(nbKey);
        const relatedComponentType = this.getRelatedComponentType(
          currentNode.attributes.component_type,
          focusNode.attributes.component_type
        );
        if (
          currentNodeKey === focusNodeKey ||
          relatedComponentType.indexOf(nbNode.attributes.component_type) > -1
        ) {
          relatedNodeKeys.push(nbKey);
        }
      }

      return relatedNodeKeys;
    },
    focusOnNode(nodeKey) {
      this.currentFocusNodeKey = nodeKey;
      var stack = [];
      var trace = new Set();
      stack.push(nodeKey);
      trace.add(nodeKey);

      while (stack.length > 0) {
        var currentNodeKey = stack.pop();
        var relatedNodeKeys = this.getRelatedNodeKeys(
          currentNodeKey,
          this.currentFocusNodeKey
        );
        for (const relatedNodeKey of relatedNodeKeys) {
          if (!trace.has(relatedNodeKey)) {
            stack.push(relatedNodeKey);
            trace.add(relatedNodeKey);
          }
        }
      }

      this.currentFocusNodePackKeys = trace;

      var xSum = 0;
      var ySum = 0;
      var n = 0;

      for (const nodeInPack of trace) {
        const nodePosition = this.renderer.getNodeDisplayData(nodeInPack);
        xSum += nodePosition.x;
        ySum += nodePosition.y;
        n += 1;
      }

      // Move the camera to center it on the selected node:
      var centroid = {
        x: xSum / n + (xSum / n) * 0.1,
        y: ySum / n - (ySum / n) * 0.1,
      };
      this.renderer.getCamera().animate(centroid, {
        duration: 500,
      });

      this.showNodeDetails();
    },
    removeNodeFocus() {
      this.currentFocusNodeKey = undefined;
      this.currentFocusNodePackKeys = new Set([]);
      this.renderer.refresh();
      this.hideNodeDetails();
    },
    renderNodeEvents() {
      const nodeEvents = [
        "enterNode",
        "leaveNode",
        "downNode",
        "clickNode",
        "rightClickNode",
        "doubleClickNode",
        "wheelNode",
      ];

      const thiz = this;

      nodeEvents.forEach((eventType) => {
        thiz.renderer.on(eventType, (e) => {
          // console.log(e);
          // console.log(eventType, e.node);

          if (eventType == "clickNode") {
            if (thiz.currentFocusNodeKey === e.node) {
              thiz.removeNodeFocus();
            } else {
              thiz.focusOnNode(e.node);
            }
          }
        });
      });
    },
    renderEdgeEvents() {
      const thiz = this;
      this.renderer.on("enterEdge", ({ edge }) => {
        thiz.hoveredEdge = edge;
        thiz.renderer.refresh();
      });
      this.renderer.on("leaveEdge", ({ edge }) => {
        thiz.hoveredEdge = null;
        thiz.renderer.refresh();
      });
    },
    createNodesAndEdges() {
      // Create a sample graph
      const graph = new Graph();

      const executors = this.provenance.executors;

      for (const executor of executors) {
        delete executor._id;
        graph.addNode(`${executor.executor_id}`, {
          color: this.legend[`${executor.executor_type}_executor`].color,
          size: 15,
          label: `${executor.executor_info.exp_name}`,
          info: executor,
          node_type: `${executor.executor_type}_executor`,
          component_type: `executor`,
        });
      }

      const taskSheets = this.provenance.task_sheets;

      for (const tasksheet of taskSheets) {
        delete tasksheet._id;
        graph.addNode(`${tasksheet.task_sheet_id}`, {
          color: this.legend[`${tasksheet.task_type}_tasksheet`].color,
          size: 10,
          label: `${tasksheet.task_sheet_name}`,
          info: tasksheet,
          node_type: `${tasksheet.task_type}_tasksheet`,
          component_type: `tasksheet`,
        });

        if (tasksheet.model_service_executor_id !== "") {
          graph.addEdge(
            tasksheet.task_sheet_id,
            tasksheet.model_service_executor_id,
            { type: "arrow", label: "usesModelExecutor", size: 3 }
          );
        }
        if (tasksheet.db_service_executor_id !== "") {
          graph.addEdge(
            tasksheet.task_sheet_id,
            tasksheet.db_service_executor_id,
            { type: "arrow", label: "usesDBExecutor", size: 3 }
          );
        }
        if (tasksheet.xai_service_executor_id !== "") {
          graph.addEdge(
            tasksheet.task_sheet_id,
            tasksheet.xai_service_executor_id,
            { type: "arrow", label: "usesXAIExecutor", size: 3 }
          );
        }
        if (tasksheet.evaluation_service_executor_id !== "") {
          graph.addEdge(
            tasksheet.task_sheet_id,
            tasksheet.evaluation_service_executor_id,
            { type: "arrow", label: "usesEvaluationExecutor", size: 3 }
          );
        }
      }

      const tasks = this.provenance.tasks;

      for (const task of tasks) {
        delete task._id;

        graph.addNode(`${task.task_ticket}`, {
          color: this.legend[`${task.task_type}_task`].color,
          size: 10,
          // label: `${task.task_name}`,
          info: task,
          node_type: `${task.task_type}_task`,
          component_type: `task`,
        });

        if (task.pipeline_id === "") {
          graph.addEdge(task.task_sheet_id, task.task_ticket, {
            type: "arrow",
            label: "hasDirectlyTask",
            size: 3,
          });
        }
      }

      const pipelines = this.provenance.pipelines;

      for (const pipeline of pipelines) {
        delete pipeline._id;

        graph.addNode(`${pipeline.pipeline_id}`, {
          color: this.legend.pipeline.color,
          size: 20,
          label: `${pipeline.pipeline_name}`,
          info: pipeline,
          node_type: "pipeline",
          component_type: "pipeline",
        });

        graph.addEdge(pipeline.pipeline_id, pipeline.xai_task_sheet_id, {
          type: "arrow",
          label: "hasXAITaskSheet",
          size: 3,
        });

        graph.addEdge(pipeline.pipeline_id, pipeline.evaluation_task_sheet_id, {
          type: "arrow",
          label: "hasEvaluationTaskSheet",
          size: 3,
        });
      }

      const pipeline_runs = this.provenance.pipeline_runs;

      for (const pipeline_run of pipeline_runs) {
        delete pipeline_run._id;

        graph.addNode(`${pipeline_run.pipeline_run_ticket}`, {
          color: this.legend.pipeline_run.color,
          size: 20,
          label: `${pipeline_run.pipeline_run_name}`,
          info: pipeline_run,
          node_type: "pipeline_run",
          component_type: "pipeline_run",
        });

        // graph.addEdge(
        //   pipeline_run.pipeline_run_ticket,
        //   pipeline_run.xai_task_sheet_id,
        //   {
        //     type: "arrow",
        //     label: "runFromXAITaskSheet",
        //     size: 5,
        //   }
        // );

        graph.addEdge(
          pipeline_run.pipeline_run_ticket,
          pipeline_run.xai_task_ticket,
          {
            type: "arrow",
            label: "hasXAIResult",
            size: 3,
          }
        );

        // graph.addEdge(
        //   pipeline_run.pipeline_run_ticket,
        //   pipeline_run.evaluation_task_sheet_id,
        //   {
        //     type: "arrow",
        //     label: "runFromEvaluationTaskSheet",
        //     size: 5,
        //   }
        // );

        graph.addEdge(
          pipeline_run.pipeline_run_ticket,
          pipeline_run.evaluation_task_ticket,
          {
            type: "arrow",
            label: "hasEvalResult",
            size: 3,
          }
        );

        graph.addEdge(
          pipeline_run.pipeline_id,
          pipeline_run.pipeline_run_ticket,
          {
            type: "arrow",
            label: "hasRun",
            size: 3,
          }
        );
      }

      this.graph = graph;
      return graph;
    },
    renderGraph() {
      const box = document.getElementById("graphbox");

      const graph = this.createNodesAndEdges();

      // random.assign(graph);
      circlepack.assign(graph, {
        hierarchyAttributes: ["node_type"],
      });
      // circular.assign(graph);

      const sensibleSettings = forceAtlas2.inferSettings(graph);
      forceLayout.assign(graph, {
        maxIterations: 100,
        settings: sensibleSettings,
      });

      forceAtlas2.assign(graph, {
        iterations: 100,
        settings: sensibleSettings,
      });

      // const layout = new FA2Layout(graph, {
      //   iterations: 500,
      //   settings: sensibleSettings,
      // });

      // layout.start();
      // this.layout = layout;

      // Create the sigma
      const thiz = this;
      this.renderer = new Sigma(graph, box, {
        enableEdgeHoverEvents: "debounce",
        // renderEdgeLabels: true,
        labelFont: "console",
        edgeLabelFont: "console",
        labelWeight: 600,
        edgeLabelWeight: 400,
      });

      this.renderCamara();
      this.renderNodeEvents();
      this.renderEdgeEvents();

      this.renderer.setSetting("nodeReducer", (node, data) => {
        const res = { ...data };
        if (
          this.currentFocusNodePackKeys.size > 0 &&
          !this.currentFocusNodePackKeys.has(node) &&
          this.currentFocusNodeKey !== node
        ) {
          res.label = "";
          res.color = "#f6f6f6";
        }
        if (node === this.currentFocusNodeKey) {
          res.highlighted = true;
        }
        return res;
      });

      this.renderer.setSetting("edgeReducer", (edge, data) => {
        const res = { ...data };

        if (
          this.currentFocusNodePackKeys.size > 0 &&
          !(
            this.currentFocusNodePackKeys.has(thiz.graph.target(edge)) &&
            this.currentFocusNodePackKeys.has(thiz.graph.source(edge))
          )
        ) {
          res.hidden = true;
        }

        if (edge === thiz.hoveredEdge) {
          res.color = "#cc1100";
          res.size = 10;
        }

        return res;
      });
    },
  },
  mounted: function () {
    this.getProvenance(() => {
      try {
        this.renderGraph();
      } catch (error) {
        console.error(error);
      }
    });
  },
  unmounted: function () {
    // console.log("unmount prov");
    try {
      if (this.layout) {
        this.layout.stop();
        this.layout.kill();
      }
      this.renderer.clear();
      // prevent Too many active WebGL contexts. Oldest context will be lost.
      this.renderer.kill();
    } catch (error) {
      console.error(error);
    }
  },
};
</script>

<style>
.fade-enter-active {
  transition: all 0.2s;
}
.fade-leave-active {
  transition: all 0.2s ease-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
#graphbox {
  height: 100%;
  width: 100%;
}
#nodeDetails {
  transition: top 0.8s, left 0.8s, opacity 0.2s;
  /* display: block; */
  list-style: none;
  margin: 0;
  padding: 0;
  position: absolute;
  width: 250px;
  z-index: 999999;
  height: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
#controls {
  position: absolute;
  right: 1em;
  top: 76px;
  background-color: white;
}
#search {
  position: absolute;
  right: 1em;
  top: 120px;
  width: 300px;
  background-color: white;
  border: 1px #00000026 solid;
  padding: 6px 6px 10px 6px;
  border-radius: 10px;
}
#legend {
  position: absolute;
  left: 1em;
  bottom: 14px;
  background-color: white;
  border: 1px #00000026 solid;
  padding: 6px;
  border-radius: 10px;
}

.legendTitle {
  float: right;
  height: 21.73px;
  line-height: 21.73px;
  margin-left: 5px;
  width: 180px;
}
</style>
