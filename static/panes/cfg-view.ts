// Copyright (c) 2022, Compiler Explorer Authors
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright notice,
//       this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

import { Pane } from "./pane";
import * as monaco from 'monaco-editor';

import _ from 'underscore';

import { CfgState } from "./cfg-view.interfaces";
import { Hub } from "../hub";
import { Container } from "golden-layout";
import { PaneState } from "./pane.interfaces";
import { ga } from "../analytics";

import { AnnotatedCfgDescriptor, AnnotatedNodeDescriptor, CFGResult } from "../../types/compilation/cfg.interfaces";
import { GraphLayoutCore } from "../graph-layout-core";

export class Cfg extends Pane<CfgState> {
    graphDiv: HTMLElement;
    canvas: HTMLCanvasElement;
    blockContainer: HTMLElement;
    constructor(hub: Hub, container: Container, state: CfgState & PaneState) {
        super(hub, container, state);
        this.eventHub.emit('cfgViewOpened', this.compilerInfo.compilerId);
        this.eventHub.emit('requestFilters', this.compilerInfo.compilerId);
        this.eventHub.emit('requestCompiler', this.compilerInfo.compilerId);
        this.graphDiv = this.domRoot.find(".graph")[0];
        this.canvas = this.domRoot.find("canvas")[0] as HTMLCanvasElement;
        this.blockContainer = this.domRoot.find(".block-container")[0];
    }
    override getInitialHTML() {
        return $('#cfg').html();
    }
    override getDefaultPaneName() {
        return "CFG";
    }
    override registerOpeningAnalyticsEvent(): void {
        ga.proxy('send', {
            hitType: 'event',
            eventCategory: 'OpenViewPane',
            eventAction: 'CFGViewPane',
        });
    }
    override onCompiler(compilerId: number, compiler: any, options: unknown, editorId: number, treeId: number): void {
        if (this.compilerInfo.compilerId !== compilerId) return;
        this.compilerInfo.compilerName = compiler ? compiler.name : '';
        this.compilerInfo.editorId = editorId;
        this.compilerInfo.treeId = treeId;
        this.updateTitle();
        if (compiler && !compiler.supportsLLVMOptPipelineView) {
            //this.editor.setValue('<LLVM IR output is not supported for this compiler>');
        }
    }
    override onCompileResult(compilerId: number, compiler: any, result: any): void {
        if (this.compilerInfo.compilerId !== compilerId) return;
        //console.log(result);
        if(result.cfg) {
            const cfg = result.cfg as CFGResult;
            const fn = cfg[Object.keys(cfg)[0]];
            for(const node of fn.nodes) {
                this.blockContainer.innerHTML += `<div class="block" data-bb-id="${node.id}">${node.label.replace(/\n/g, "<br/>")}</div>`;
            }
            for(const node of fn.nodes) {
                //const elem = $(this.blockContainer).find(`.block[data-bb-id="${node.id}"]`)[0];
                //(node as AnnotatedNodeDescriptor).width = elem.getBoundingClientRect().width;
                //(node as AnnotatedNodeDescriptor).height = elem.getBoundingClientRect().height;
                const elem = $(this.blockContainer).find(`.block[data-bb-id="${node.id}"]`);
                void(elem[0].offsetHeight);
                (node as AnnotatedNodeDescriptor).width = elem.outerWidth() as number;
                (node as AnnotatedNodeDescriptor).height = elem.outerHeight() as number;
                //console.log(elem, elem.outerWidth(), elem.outerHeight(), elem[0].offsetHeight,  node);
            }
            //console.log("test");
            //console.log(fn.nodes);
            const x = new GraphLayoutCore(fn as AnnotatedCfgDescriptor);
            this.graphDiv.style.height = x.getHeight() + "px";
            this.graphDiv.style.width = x.getWidth() + "px";
            this.canvas.style.height = x.getHeight() + "px";
            this.canvas.style.width = x.getWidth() + "px";
            this.canvas.height = x.getHeight();
            this.canvas.width = x.getWidth();
            this.blockContainer.style.height = x.getHeight() + "px";
            this.blockContainer.style.width = x.getWidth() + "px";
            const ctx = this.canvas.getContext("2d")!;
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#ffffff";
            ctx.fillStyle = "#ffffff";
            for(const block of x.blocks) {
                const elem = $(this.blockContainer).find(`.block[data-bb-id="${block.data.id}"]`)[0];
                elem.style.top = block.coordinates.y + "px";
                elem.style.left = block.coordinates.x + "px";
                for(const edge of block.edges) {
                    ctx.beginPath();
                    ctx.moveTo(edge.path[0].x, edge.path[0].y);
                    for(const pathPoint of edge.path.slice(1)) {
                        ctx.lineTo(pathPoint.x, pathPoint.y);
                    }
                    ctx.stroke();
                    const endpoint = edge.path[edge.path.length - 1];
                    const triangleHeight = 5;
                    const triangleWidth = 5;
                    ctx.beginPath();
                    ctx.moveTo(endpoint.x - triangleWidth / 2, endpoint.y - triangleHeight);
                    ctx.lineTo(endpoint.x + triangleWidth / 2, endpoint.y - triangleHeight);
                    ctx.lineTo(endpoint.x, endpoint.y);
                    ctx.lineTo(endpoint.x - triangleWidth / 2, endpoint.y - triangleHeight);
                    ctx.lineTo(endpoint.x + triangleWidth / 2, endpoint.y - triangleHeight);
                    ctx.fill();
                    ctx.stroke();
                    //ctx.fillRect(edge.path[edge.path.length - 1].x - 5, edge.path[edge.path.length - 1].y - 5, 10, 10);
                }
            }
            //for(const blockRow of x.blockRows) {
            //    ctx.strokeRect(0, blockRow.totalOffset, 100, blockRow.height);
            //}
        }
        //console.log(result);
        //if (result.hasLLVMOptPipelineOutput) {
        //    this.updateResults(result.llvmOptPipelineOutput as LLVMOptPipelineOutput);
        //} else if (compiler.supportsLLVMOptPipelineView) {
        //    this.updateResults({});
        //    this.editor.getModel()?.original.setValue('<Error>');
        //    this.editor.getModel()?.modified.setValue('');
        //}
    }
    override resize() {
        //const topBarHeight = this.topBar.outerHeight(true) as number;
        //this.editor.layout({
        //    width: this.domRoot.width() as number,
        //    height: (this.domRoot.height() as number) - topBarHeight,
        //});
    }
    override close(): void {
        this.eventHub.unsubscribe();
        this.eventHub.emit('cfgViewClosed', this.compilerInfo.compilerId);
    }
};
