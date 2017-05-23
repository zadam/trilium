<template>
<!-- the demo root element -->
<ul id="demo">
  <item
    class="item"
    :model="treeData">
  </item>
</ul>
</template

<script type="text/x-template" id="item-template">
  <li>
    <div
      :class="{bold: isFolder}"
      @click="toggle"
      @dblclick="changeType">
      {{model.note_title}}
      <span v-if="isFolder">[{{open ? '-' : '+'}}]</span>
    </div>
    <ul v-show="open" v-if="isFolder">
      <item
        class="item"
        v-for="model in model.children"
        :model="model">
      </item>
      <li class="add" @click="addChild">+</li>
    </ul>
  </li>
</script>

<style>
.item {
  cursor: pointer;
}
.bold {
  font-weight: bold;
}
ul {
  padding-left: 1em;
  line-height: 1.5em;
  list-style-type: dot;
}
</style>